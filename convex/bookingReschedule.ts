import { v } from "convex/values";
import { err, ok, type Result } from "../src/lib/result";
import { internal } from "./_generated/api";
import {
	internalMutation,
	internalQuery,
	mutation,
	query,
	type ActionCtx,
	type MutationCtx,
	type QueryCtx
} from "./_generated/server";
import type { Doc } from "./_generated/dataModel";
import { env } from "./env";
import { getBookingFromDb } from "./lib/bookingLookup";
import { getAdminIdentity } from "./lib/auth";
import {
	buildRescheduleUrl,
	createActiveRescheduleLinkForBooking,
	hashRescheduleToken,
	isRescheduleLinkExpired,
	markExistingActiveRescheduleLinksUsed
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

export type RescheduleLinkLookupError =
	| { reason: "RESCHEDULE_LINK_NOT_FOUND" }
	| { reason: "RESCHEDULE_LINK_USED" }
	| { reason: "RESCHEDULE_LINK_EXPIRED" }
	| { reason: "BOOKING_NOT_FOUND" }
	| { reason: "BOOKING_NOT_RESCHEDULABLE" };

interface ValidRescheduleLinkAndBooking {
	booking: Doc<"bookings">;
	link: Doc<"bookingRescheduleLinks">;
}

function isBookingReschedulable(booking: Doc<"bookings">) {
	if (booking.status === "confirmed" || booking.status === "email_failed") {
		return true;
	}

	return (
		booking.status === "failed" &&
		(booking.bookingFailureCode === "BOOKING_TIME_UNAVAILABLE" ||
			booking.bookingFailureCode === "GOOGLE_CALENDAR_CREATE_FAILED")
	);
}

export function getRescheduleUrlForToken(token: string) {
	return buildRescheduleUrl(new URL(env.STRIPE_CHECKOUT_RETURN_URL).origin, token);
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

	return ok(getRescheduleUrlForToken(link.token));
}

export const createPublicFailedBookingRescheduleLink = mutation({
	args: { stripeSessionId: v.string() },
	handler: (ctx, args) => createPublicFailedBookingRescheduleLinkHandler(ctx, args)
});

async function createPublicFailedBookingRescheduleLinkHandler(
	ctx: MutationCtx,
	args: { stripeSessionId: string }
) {
	const booking = await ctx.db
		.query("bookings")
		.withIndex("by_stripeSessionId", (query) => query.eq("stripeSessionId", args.stripeSessionId))
		.unique();

	if (booking === null) {
		return err({ reason: "BOOKING_NOT_FOUND" });
	}

	if (!isBookingReschedulable(booking)) {
		return err({ reason: "BOOKING_NOT_RESCHEDULABLE" });
	}

	if (booking.status !== "failed") {
		return err({ reason: "BOOKING_NOT_FAILED" });
	}

	if (booking.sessionStartAt <= Date.now()) {
		return err({ reason: "RESCHEDULE_LINK_EXPIRED" });
	}

	const now = Date.now();
	const link = await createActiveRescheduleLinkForBooking({
		ctx,
		booking,
		expiresAt: booking.sessionStartAt,
		now
	});

	return ok({
		rescheduleUrl: buildRescheduleUrl(new URL(env.STRIPE_CHECKOUT_RETURN_URL).origin, link.token)
	});
}

export type CreatePublicFailedBookingRescheduleLinkResult = Awaited<
	ReturnType<typeof createPublicFailedBookingRescheduleLinkHandler>
>;

export const createAdminRescheduleLink = mutation({
	args: { bookingId: v.id("bookings") },
	handler: (ctx, args) => createAdminRescheduleLinkHandler(ctx, args)
});

async function createAdminRescheduleLinkHandler(
	ctx: MutationCtx,
	args: { bookingId: Doc<"bookings">["_id"] }
) {
	const [authError] = await getAdminIdentity(ctx);

	if (authError !== null) {
		return err(authError);
	}

	const [bookingError, booking] = await getBookingFromDb(ctx, args.bookingId);

	if (bookingError !== null) {
		return err(bookingError);
	}

	if (!isBookingReschedulable(booking)) {
		return err({ reason: "BOOKING_NOT_RESCHEDULABLE" });
	}

	if (booking.sessionStartAt <= Date.now()) {
		return err({ reason: "RESCHEDULE_LINK_EXPIRED" });
	}

	const now = Date.now();
	const link = await createActiveRescheduleLinkForBooking({
		ctx,
		booking,
		expiresAt: booking.sessionStartAt,
		now
	});

	return ok({
		rescheduleUrl: buildRescheduleUrl(new URL(env.STRIPE_CHECKOUT_RETURN_URL).origin, link.token)
	});
}

export type CreateAdminRescheduleLinkResult = Awaited<
	ReturnType<typeof createAdminRescheduleLinkHandler>
>;

export const getRescheduleBookingByToken = query({
	args: { token: v.string() },
	handler: (ctx, args) => getRescheduleBookingByTokenHandler(ctx, args)
});

async function getRescheduleBookingByTokenHandler(
	ctx: QueryCtx,
	args: GetRescheduleBookingByTokenArgs
): Promise<Result<RescheduleBookingSummary, RescheduleLinkLookupError>> {
	const [lookupError, result]: GetValidRescheduleLinkAndBookingResult = await ctx.runQuery(
		internal.bookingReschedule.getValidRescheduleLinkAndBookingInternal,
		{ now: Date.now(), token: args.token }
	);

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

export const getValidRescheduleLinkAndBookingInternal = internalQuery({
	args: { token: v.string(), now: v.number() },
	handler: (ctx, args) => getValidRescheduleLinkAndBookingInternalHandler(ctx, args)
});

async function getValidRescheduleLinkAndBookingInternalHandler(
	ctx: QueryCtx,
	args: { now: number; token: string }
): Promise<Result<ValidRescheduleLinkAndBooking, RescheduleLinkLookupError>> {
	const tokenHash = await hashRescheduleToken(args.token);
	const link = await ctx.db
		.query("bookingRescheduleLinks")
		.withIndex("by_tokenHash", (q) => q.eq("tokenHash", tokenHash))
		.unique();

	if (link === null) {
		return err({ reason: "RESCHEDULE_LINK_NOT_FOUND" });
	}

	if (link.status === "used") {
		return err({ reason: "RESCHEDULE_LINK_USED" });
	}

	if (link.status === "expired") {
		return err({ reason: "RESCHEDULE_LINK_EXPIRED" });
	}

	const booking = await ctx.db.get(link.bookingId);

	if (booking === null) {
		return err({ reason: "BOOKING_NOT_FOUND" });
	}

	if (isRescheduleLinkExpired(link, booking, args.now)) {
		return err({ reason: "RESCHEDULE_LINK_EXPIRED" });
	}

	if (!isBookingReschedulable(booking)) {
		return err({ reason: "BOOKING_NOT_RESCHEDULABLE" });
	}

	return ok({ booking, link });
}

type GetValidRescheduleLinkAndBookingResult = Awaited<
	ReturnType<typeof getValidRescheduleLinkAndBookingInternalHandler>
>;

export const createActiveRescheduleLinkInternal = internalMutation({
	args: { bookingId: v.id("bookings"), expiresAt: v.number(), now: v.number() },
	handler: async (ctx, args) => {
		const [bookingError, booking] = await getBookingFromDb(ctx, args.bookingId);

		if (bookingError !== null) {
			return err(bookingError);
		}

		const link = await createActiveRescheduleLinkForBooking({
			booking,
			ctx,
			expiresAt: args.expiresAt,
			now: args.now
		});

		return ok(link);
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

export const unlockRescheduleLinkInternal = internalMutation({
	args: {
		linkId: v.id("bookingRescheduleLinks"),
		lockedAt: v.number(),
		expiresAt: v.optional(v.number())
	},
	handler: async (ctx, args) => {
		const link = await ctx.db.get(args.linkId);

		// Only unlock a used link with the same lock time set by this request.
		// This prevents an older request from unlocking a newer request's lock.
		if (link === null || link.status !== "used" || link.usedAt !== args.lockedAt) {
			return err({ reason: "RESCHEDULE_LINK_USED" });
		}

		await ctx.db.patch(args.linkId, {
			status: "active",
			usedAt: undefined,
			...(args.expiresAt !== undefined ? { expiresAt: args.expiresAt } : {})
		});
		return ok({ reactivated: true });
	}
});

export const lockRescheduleLinkInternal = internalMutation({
	args: { linkId: v.id("bookingRescheduleLinks"), now: v.number() },
	handler: async (ctx, args) => {
		const link = await ctx.db.get(args.linkId);

		if (link === null) {
			return err({ reason: "RESCHEDULE_LINK_NOT_FOUND" });
		}

		if (link.status !== "active") {
			return err({
				reason: link.status === "used" ? "RESCHEDULE_LINK_USED" : "RESCHEDULE_LINK_EXPIRED"
			});
		}

		await ctx.db.patch(args.linkId, { status: "used", usedAt: args.now });
		return ok({ used: true });
	}
});
