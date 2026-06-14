import { v } from "convex/values";
import { err, ok, type Result } from "../src/lib/result";
import { internal } from "./_generated/api";
import { internalMutation, query, type ActionCtx, type QueryCtx } from "./_generated/server";
import type { Doc } from "./_generated/dataModel";
import { env } from "./env";
import { getBookingFromDb } from "./lib/bookingLookup";
import {
	generateRescheduleToken,
	hashRescheduleToken,
	markExistingActiveRescheduleLinksUsed,
	buildRescheduleUrl,
	getValidRescheduleLinkAndBooking
} from "./lib/bookingRescheduleLinks";

interface GetRescheduleBookingByTokenArgs {
	token: string;
}

interface RescheduleBookingSummary {
	booking: {
		date: string;
		time: string;
		duration: string;
		service: string;
		addons: string[];
		name: string;
	};
	expiresAt: number;
}

export async function createRescheduleUrlForBooking(ctx: ActionCtx, booking: Doc<"bookings">) {
	const now = Date.now();
	const [linkError, link] = await ctx.runMutation(
		internal.bookingReschedule.createActiveRescheduleLinkInternal,
		{ bookingId: booking._id, expiresAt: booking.sessionStartAt, now }
	);

	if (linkError !== null) {
		return err({ reason: "RESCHEDULE_LINK_CREATE_FAILED" });
	}

	return ok(buildRescheduleUrl(new URL(env.STRIPE_CHECKOUT_RETURN_URL).origin, link.token));
}

export const getRescheduleBookingByToken = query({
	args: { token: v.string() },
	handler: (ctx, args) => getRescheduleBookingByTokenHandler(ctx, args)
});

async function getRescheduleBookingByTokenHandler(
	ctx: QueryCtx,
	args: GetRescheduleBookingByTokenArgs
): Promise<
	Result<
		RescheduleBookingSummary,
		| { reason: "RESCHEDULE_LINK_NOT_FOUND" }
		| { reason: "RESCHEDULE_LINK_USED" }
		| { reason: "RESCHEDULE_LINK_EXPIRED" }
		| { reason: "BOOKING_NOT_FOUND" }
		| { reason: "BOOKING_NOT_RESCHEDULABLE" }
	>
> {
	const [lookupError, result] = await getValidRescheduleLinkAndBooking(ctx, args.token, Date.now());

	if (lookupError !== null) {
		return err(lookupError);
	}

	const { booking, link } = result;

	return ok({
		booking: {
			date: booking.date,
			time: booking.time,
			duration: booking.duration,
			service: booking.service,
			addons: booking.addons,
			name: booking.name
		},
		expiresAt: link.expiresAt
	});
}

export type GetRescheduleBookingByTokenResult = Awaited<
	ReturnType<typeof getRescheduleBookingByTokenHandler>
>;

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
