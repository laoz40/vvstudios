import { v } from "convex/values";
import { err, ok } from "../src/lib/result";
import { internalMutation, internalQuery } from "./_generated/server";
import { getSessionFromDb } from "./lib/sessionLookup";

export const listSessionsDueForReminderEmail = internalQuery({
	args: { dayStart: v.number(), dayEnd: v.number(), limit: v.optional(v.number()) },
	handler: async (ctx, args) => {
		return await ctx.db
			.query("bookings")
			.withIndex("by_status_and_reminderEmailSentAt_and_sessionStartAt", (indexQuery) =>
				indexQuery
					.eq("status", "confirmed")
					.eq("reminderEmailSentAt", undefined)
					.gte("sessionStartAt", args.dayStart)
					.lt("sessionStartAt", args.dayEnd)
			)
			.take(args.limit ?? 50);
	}
});

export const claimSessionReminderEmail = internalMutation({
	args: { bookingId: v.id("bookings"), now: v.number() },
	handler: async (ctx, args) => {
		const session = await ctx.db.get(args.bookingId);

		if (!session || (session.status !== "confirmed" && session.status !== "email_failed")) {
			return err({ reason: "BOOKING_NOT_SENDABLE" });
		}

		if (session.reminderEmailSentAt || session.reminderEmailClaimedAt) {
			return err({ reason: "BOOKING_ALREADY_CLAIMED_OR_SENT" });
		}

		await ctx.db.patch(args.bookingId, {
			reminderEmailClaimedAt: args.now,
			reminderEmailFailureCode: undefined
		});

		return ok({ session });
	}
});

export const markSessionReminderEmailSent = internalMutation({
	args: { bookingId: v.id("bookings"), now: v.number() },
	handler: async (ctx, args) => {
		const [bookingError] = await getSessionFromDb(ctx, args.bookingId);

		if (bookingError !== null) {
			return err(bookingError);
		}

		await ctx.db.patch(args.bookingId, {
			reminderEmailClaimedAt: undefined,
			reminderEmailSentAt: args.now,
			reminderEmailFailureCode: undefined
		});

		return ok({ updated: true });
	}
});

export const markSessionReminderEmailFailed = internalMutation({
	args: { bookingId: v.id("bookings"), failureCode: v.string() },
	handler: async (ctx, args) => {
		const [bookingError] = await getSessionFromDb(ctx, args.bookingId);

		if (bookingError !== null) {
			return err(bookingError);
		}

		await ctx.db.patch(args.bookingId, {
			reminderEmailClaimedAt: undefined,
			reminderEmailFailureCode: args.failureCode
		});

		return ok({ updated: true });
	}
});
