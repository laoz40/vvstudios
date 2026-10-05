import { v } from "convex/values";
import { tupleErr, tupleOk } from "#/lib/result";
import { internalMutation, internalQuery } from "#convex/_generated/server";
import { checkBookingSubmitRateLimit } from "#convex/lib/rateLimits";
import {
	bookingAddonQuantitiesValidator,
	bookingAddonsValidator
} from "#convex/lib/booking/bookingAddonQuantities";
import { env } from "#convex/env";
import { okOrThrow } from "#convex/lib/result";
import { archiveDeadCheckoutBooking } from "#convex/lib/sessions/sessionArchive";
import {
	validatePendingSessionDeletion,
	validateSessionExpiry,
	type DeletePendingSessionSuccess
} from "#convex/lib/sessions/sessionCheckout";
import { getSessionStartAt } from "#convex/lib/sessions/sessionAdminEdit";
import {
	assertCheckoutSessionAvailable,
	createPendingCheckoutBooking
} from "#convex/services/booking/sessionCheckout";
import { ok } from "neverthrow";

export const checkSessionSubmitRateLimit = internalMutation({
	args: { submitRateLimitKey: v.string() },
	handler: (ctx, args) =>
		checkBookingSubmitRateLimit(ctx, args.submitRateLimitKey).match(tupleOk, tupleErr)
});

export const createPendingSession = internalMutation({
	args: {
		name: v.string(),
		phone: v.string(),
		accountName: v.string(),
		abn: v.optional(v.string()),
		email: v.string(),
		date: v.string(),
		time: v.string(),
		duration: v.string(),
		service: v.string(),
		addons: bookingAddonsValidator,
		...bookingAddonQuantitiesValidator,
		notes: v.optional(v.string())
	},
	handler: (ctx, args) =>
		assertCheckoutSessionAvailable(ctx, args)
			.andThen(() => getSessionStartAt(args.date, args.time, env.GOOGLE_CALENDAR_TIMEZONE))
			.andThen((sessionStartAt) => createPendingCheckoutBooking(ctx, args, sessionStartAt))
			.match(tupleOk, tupleErr)
});

export const getSessionByStripeSessionId = internalQuery({
	args: { stripeSessionId: v.string() },
	handler: async (ctx, args) => {
		return await ctx.db
			.query("bookings")
			.withIndex("by_stripeSessionId", (indexQuery) =>
				indexQuery.eq("stripeSessionId", args.stripeSessionId)
			)
			.unique();
	}
});

export const setSessionStripeSessionId = internalMutation({
	args: { bookingId: v.id("bookings"), stripeSessionId: v.string(), stripeCustomerId: v.string() },
	handler: async (ctx, args) => {
		return await ctx.db.patch("bookings", args.bookingId, {
			stripeSessionId: args.stripeSessionId,
			stripeCustomerId: args.stripeCustomerId
		});
	}
});

export const markSessionExpiredByStripeSessionId = internalMutation({
	args: { stripeSessionId: v.string() },
	handler: (ctx, args) =>
		okOrThrow(
			ctx.db
				.query("bookings")
				.withIndex("by_stripeSessionId", (indexQuery) =>
					indexQuery.eq("stripeSessionId", args.stripeSessionId)
				)
				.unique()
		)
			.andThen(validateSessionExpiry)
			.andThen((decision) => {
				if (decision.kind === "complete") {
					return ok<{ alreadyExpired: boolean }>({ alreadyExpired: decision.alreadyExpired });
				}

				return archiveDeadCheckoutBooking(ctx, decision.bookingId, { status: "expired" }).map(
					() => ({ alreadyExpired: false })
				);
			})
			.match(tupleOk, tupleErr)
});

export const deletePendingSession = internalMutation({
	args: { bookingId: v.id("bookings"), stripeSessionId: v.string() },
	handler: (ctx, args) =>
		okOrThrow(ctx.db.get("bookings", args.bookingId))
			.andThen((booking) => validatePendingSessionDeletion(booking, args.stripeSessionId))
			.andThen((decision) => {
				if (decision.kind === "complete") {
					return ok<DeletePendingSessionSuccess>(decision.value);
				}

				return archiveDeadCheckoutBooking(ctx, args.bookingId, { status: "abandoned" }).map(
					(): DeletePendingSessionSuccess => ({ outcome: "abandoned" })
				);
			})
			.match(tupleOk, tupleErr)
});
