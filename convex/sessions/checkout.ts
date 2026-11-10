import { v, type VString } from "convex/values";
import {
	BOOKING_ADDON_QUANTITY_FIELD_BY_ADDON,
	type BookingAddonQuantityFieldName
} from "#/domain/booking/addon-quantities";
import { ok, safeTry } from "neverthrow";
import { tupleErr, tupleOk } from "#/lib/result";
import { internalMutation, internalQuery } from "#convex/_generated/server";
import { bookingAddonsValidator } from "#convex/schema";
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

export const bookingAddonQuantitiesValidator = {
	[BOOKING_ADDON_QUANTITY_FIELD_BY_ADDON["Essential Edit"]]: v.optional(v.string()),
	[BOOKING_ADDON_QUANTITY_FIELD_BY_ADDON["Complete Edit"]]: v.optional(v.string()),
	[BOOKING_ADDON_QUANTITY_FIELD_BY_ADDON["Clip Volume Pack"]]: v.optional(v.string()),
	[BOOKING_ADDON_QUANTITY_FIELD_BY_ADDON["Handcrafted Clips"]]: v.optional(v.string())
} satisfies Record<BookingAddonQuantityFieldName, VString<string | undefined, "optional">>;

export const bookingDetailsFieldsValidator = {
	name: v.string(),
	phone: v.string(),
	accountName: v.string(),
	abn: v.optional(v.string()),
	email: v.string(),
	duration: v.string(),
	addons: bookingAddonsValidator,
	...bookingAddonQuantitiesValidator,
	notes: v.optional(v.string())
};

export const checkSessionSubmitRateLimit = internalMutation({
	args: { submitRateLimitKey: v.string() },
	handler: (ctx, args) =>
		enforceBookingSubmitRateLimit(ctx, args.submitRateLimitKey).match(tupleOk, tupleErr)
});

export const createPendingSession = internalMutation({
	args: {
		...bookingDetailsFieldsValidator,
		date: v.string(),
		time: v.string(),
		service: v.string()
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
