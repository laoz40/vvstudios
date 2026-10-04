import { v } from "convex/values";
import { ADDON_OPTIONS } from "#studio/features/booking-form/lib/booking-form-model";
import { tupleErr, tupleOk } from "#/lib/result";
import { internalMutation, internalQuery } from "#convex/_generated/server";
import { checkBookingSubmitRateLimit } from "#convex/lib/rateLimits";

const bookingAddonValidator = v.union(...ADDON_OPTIONS.map((addon) => v.literal(addon)));

const bookingAddonsValidator = v.array(bookingAddonValidator);

const bookingAddonQuantitiesValidator = {
	essentialEditQuantity: v.optional(v.string()),
	completeEditQuantity: v.optional(v.string()),
	clipsPackageQuantity: v.optional(v.string()),
	handcraftedClipsQuantity: v.optional(v.string())
};

import {
	createPendingSessionService,
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
	handler: (ctx, args) => createPendingSessionService(ctx, args).match(tupleOk, tupleErr)
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
