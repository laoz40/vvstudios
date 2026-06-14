import { err, ok } from "../src/lib/result";
import { v } from "convex/values";
import { internalMutation } from "./_generated/server";
import { getBookingFromDb } from "./lib/bookingLookup";
import {
	generateRescheduleToken,
	hashRescheduleToken,
	markExistingActiveRescheduleLinksUsed
} from "./lib/bookingRescheduleLinks";

export const createActiveRescheduleLinkInternal = internalMutation({
	args: { bookingId: v.id("bookings"), expiresAt: v.number(), now: v.number() },
	handler: async (ctx, args) => {
		const [bookingError] = await getBookingFromDb(ctx, args.bookingId);

		if (bookingError !== null) {
			return err(bookingError);
		}

		await markExistingActiveRescheduleLinksUsed({ ctx, bookingId: args.bookingId, now: args.now });

		const token = generateRescheduleToken();
		const tokenHash = await hashRescheduleToken(token);
		const linkId = await ctx.db.insert("bookingRescheduleLinks", {
			bookingId: args.bookingId,
			tokenHash,
			status: "active",
			expiresAt: args.expiresAt,
			createdAt: args.now
		});

		return ok({ linkId, token });
	}
});

export const markActiveRescheduleLinksUsedForBookingInternal = internalMutation({
	args: { bookingId: v.id("bookings"), now: v.number() },
	handler: async (ctx, args) => {
		const [bookingError] = await getBookingFromDb(ctx, args.bookingId);

		if (bookingError !== null) {
			return err(bookingError);
		}

		await markExistingActiveRescheduleLinksUsed({ ctx, bookingId: args.bookingId, now: args.now });

		return ok({ used: true });
	}
});

export const markRescheduleLinkUsedInternal = internalMutation({
	args: { linkId: v.id("bookingRescheduleLinks"), now: v.number() },
	handler: async (ctx, args) => {
		const link = await ctx.db.get(args.linkId);

		if (link === null) {
			return err({ reason: "RESCHEDULE_LINK_NOT_FOUND" });
		}

		await ctx.db.patch(args.linkId, { status: "used", usedAt: args.now });
		return ok({ used: true });
	}
});
