import { v } from "convex/values";
import { ok, safeTry } from "neverthrow";
import { tupleErr, tupleOk } from "#/lib/result";
import { internalMutation, internalQuery } from "#convex/_generated/server";
import {
	bookingAddonQuantitiesValidator,
	bookingAddonsValidator
} from "#convex/booking/services/formValidators";
import {
	abandonPendingCheckoutBooking,
	createPendingCheckoutBooking,
	enforceBookingSubmitRateLimit,
	expirePendingCheckoutByStripeSessionId,
	loadBookingRowByStripeSessionId,
	parseCheckoutSessionStartTime,
	rejectCheckoutSlotUnavailable,
	writeBookingStripeCheckoutIds
} from "#convex/booking/services/checkout";

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
		safeTry(async function* () {
			yield* rejectCheckoutSlotUnavailable(ctx, args);
			const sessionStartAt = yield* parseCheckoutSessionStartTime(args);
			const booking = yield* createPendingCheckoutBooking(ctx, args, sessionStartAt);

			return ok(booking);
		}).match(tupleOk, tupleErr)
});

export const getSessionByStripeSessionId = internalQuery({
	args: { stripeSessionId: v.string() },
	handler: (ctx, args) =>
		loadBookingRowByStripeSessionId(ctx, args.stripeSessionId).match(tupleOk, tupleErr)
});

export const setSessionStripeSessionId = internalMutation({
	args: { bookingId: v.id("bookings"), stripeSessionId: v.string(), stripeCustomerId: v.string() },
	handler: (ctx, args) => writeBookingStripeCheckoutIds(ctx, args).match(tupleOk, tupleErr)
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
