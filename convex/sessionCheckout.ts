import { v } from "convex/values";
import { tupleErr, tupleOk } from "#/lib/result";
import { internalMutation, internalQuery } from "#convex/_generated/server";
import {
	bookingAddonQuantitiesValidator,
	bookingAddonsValidator
} from "#convex/services/booking/bookingFormValidators";
import {
	abandonPendingCheckoutBooking,
	createPendingCheckoutBooking,
	enforceBookingSubmitRateLimit,
	expirePendingCheckoutByStripeSessionId,
	loadBookingRowByStripeSessionId,
	parseCheckoutSessionStartTime,
	rejectCheckoutSlotUnavailable,
	writeBookingStripeCheckoutIds
} from "#convex/services/booking/sessionCheckout";

export const checkSessionSubmitRateLimit = internalMutation({
	args: { submitRateLimitKey: v.string() },
	handler: (ctx, args) =>
		enforceBookingSubmitRateLimit(ctx, args.submitRateLimitKey).match(tupleOk, tupleErr)
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
		rejectCheckoutSlotUnavailable(ctx, args)
			.andThen(() => parseCheckoutSessionStartTime(args))
			.andThen((sessionStartAt) => createPendingCheckoutBooking(ctx, args, sessionStartAt))
			.match(tupleOk, tupleErr)
});

export const getSessionByStripeSessionId = internalQuery({
	args: { stripeSessionId: v.string() },
	handler: async (ctx, args) =>
		(await loadBookingRowByStripeSessionId(ctx, args.stripeSessionId)).match(
			(booking) => booking,
			() => null
		)
});

export const setSessionStripeSessionId = internalMutation({
	args: { bookingId: v.id("bookings"), stripeSessionId: v.string(), stripeCustomerId: v.string() },
	handler: async (ctx, args) => await writeBookingStripeCheckoutIds(ctx, args)
});

export const markSessionExpiredByStripeSessionId = internalMutation({
	args: { stripeSessionId: v.string() },
	handler: (ctx, args) =>
		expirePendingCheckoutByStripeSessionId(ctx, args.stripeSessionId).match(tupleOk, tupleErr)
});

export const deletePendingSession = internalMutation({
	args: { bookingId: v.id("bookings"), stripeSessionId: v.string() },
	handler: (ctx, args) => abandonPendingCheckoutBooking(ctx, args).match(tupleOk, tupleErr)
});
