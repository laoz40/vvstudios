import { v } from "convex/values";
import { tupleErr, tupleOk } from "#/lib/result";
import { internalMutation, internalQuery } from "#convex/_generated/server";
import { checkBookingSubmitRateLimit } from "#convex/lib/rateLimits";
import {
	bookingAddonQuantitiesValidator,
	bookingAddonsValidator
} from "#convex/lib/booking/bookingAddonQuantities";
import { getBookingAvailabilitySettings } from "#convex/lib/booking/bookingSettings";
import { env } from "#convex/env";
import { getSessionStartAt } from "#convex/lib/sessions/sessionAdminEdit";
import {
	insertPendingCheckoutBooking,
	validateCheckoutSessionAvailability
} from "#convex/lib/sessions/pendingCheckoutSession";
import {
	deletePendingSessionService,
	markSessionExpiredByStripeSessionIdService
} from "#convex/services/booking/sessionCheckout";

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
		getBookingAvailabilitySettings(ctx)
			.andThen((settings) => validateCheckoutSessionAvailability(settings, args))
			.andThen(() => getSessionStartAt(args.date, args.time, env.GOOGLE_CALENDAR_TIMEZONE))
			.andThen((sessionStartAt) => insertPendingCheckoutBooking(ctx, args, sessionStartAt))
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
		markSessionExpiredByStripeSessionIdService(ctx, args).match(tupleOk, tupleErr)
});

export const deletePendingSession = internalMutation({
	args: { bookingId: v.id("bookings"), stripeSessionId: v.string() },
	handler: (ctx, args) => deletePendingSessionService(ctx, args).match(tupleOk, tupleErr)
});
