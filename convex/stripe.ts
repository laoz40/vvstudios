"use node";

import { v } from "convex/values";
import { action } from "./_generated/server";
import { tupleErr, tupleOk } from "#/lib/result";
import { bookingAddonQuantitiesValidator } from "./lib/bookingAddonQuantities";
import {
	closeEmbeddedCheckoutSessionService,
	createEmbeddedCheckoutSessionService
} from "./services/stripe";

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
		addons: v.array(v.string()),
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
