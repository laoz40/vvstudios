"use node";

import { v } from "convex/values";
import { action, type ActionCtx } from "./_generated/server";
import { tupleErr, tupleOk } from "#/lib/result";
import {
	closeEmbeddedCheckoutSessionService,
	createEmbeddedCheckoutSessionService,
	type CreateEmbeddedCheckoutSessionArgs
} from "./services/stripe";

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
		essentialEditQuantity: v.optional(v.string()),
		clipsPackageQuantity: v.optional(v.string()),
		notes: v.optional(v.string())
	},
	handler: (ctx, args) => createEmbeddedCheckoutSessionHandler(ctx, args)
});

// Creates a pending booking, opens a Stripe checkout session, then links both records.
async function createEmbeddedCheckoutSessionHandler(
	ctx: ActionCtx,
	args: CreateEmbeddedCheckoutSessionArgs
) {
	return await createEmbeddedCheckoutSessionService(ctx, args).match(tupleOk, tupleErr);
}

export type CreateEmbeddedCheckoutSessionResult = Awaited<
	ReturnType<typeof createEmbeddedCheckoutSessionHandler>
>;

export const closeEmbeddedCheckoutSession = action({
	args: { bookingId: v.id("bookings"), stripeSessionId: v.string() },
	handler: (ctx, args) => closeEmbeddedCheckoutSessionHandler(ctx, args)
});

async function closeEmbeddedCheckoutSessionHandler(
	ctx: ActionCtx,
	args: Parameters<typeof closeEmbeddedCheckoutSessionService>[1]
) {
	return await closeEmbeddedCheckoutSessionService(ctx, args).match(tupleOk, tupleErr);
}

export type CloseEmbeddedCheckoutSessionResult = Awaited<
	ReturnType<typeof closeEmbeddedCheckoutSessionHandler>
>;
