"use node";

import { v } from "convex/values";
import { ADDON_OPTIONS } from "#studio/features/booking-form/lib/booking-form-model";
import { action } from "#convex/_generated/server";
import { tupleErr, tupleOk } from "#/lib/result";
import {
	closeEmbeddedCheckoutSessionService,
	createEmbeddedCheckoutSessionService
} from "#convex/services/stripe/stripe";

const bookingAddonValidator = v.union(...ADDON_OPTIONS.map((addon) => v.literal(addon)));

const bookingAddonsValidator = v.array(bookingAddonValidator);

const bookingAddonQuantitiesValidator = {
	essentialEditQuantity: v.optional(v.string()),
	completeEditQuantity: v.optional(v.string()),
	clipsPackageQuantity: v.optional(v.string()),
	handcraftedClipsQuantity: v.optional(v.string())
};

// Creates a pending booking, opens a Stripe checkout session, then links both records.
export const createEmbeddedCheckoutSession = action({
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
	handler: async (ctx, args) =>
		await createEmbeddedCheckoutSessionService(ctx, args).match(tupleOk, tupleErr)
});

export const closeEmbeddedCheckoutSession = action({
	args: { bookingId: v.id("bookings"), stripeSessionId: v.string() },
	handler: async (ctx, args) =>
		await closeEmbeddedCheckoutSessionService(ctx, args).match(tupleOk, tupleErr)
});
