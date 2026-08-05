import { v } from "convex/values";
import { tupleErr, tupleOk } from "#/lib/result";
import type { Doc } from "./_generated/dataModel";
import { internalMutation, internalQuery, type MutationCtx } from "./_generated/server";
import { checkBookingSubmitRateLimit } from "./lib/rateLimits";
import {
	createPendingSessionService,
	deletePendingSessionService,
	markSessionExpiredByStripeSessionIdService,
	type CreatePendingSessionArgs
} from "./services/sessionCheckout";

export const checkSessionSubmitRateLimit = internalMutation({
	args: { submitRateLimitKey: v.string() },
	handler: (ctx, args) => checkSessionSubmitRateLimitHandler(ctx, args)
});

function checkSessionSubmitRateLimitHandler(
	ctx: MutationCtx,
	args: { submitRateLimitKey: string }
) {
	return checkBookingSubmitRateLimit(ctx, args.submitRateLimitKey).match(tupleOk, tupleErr);
}

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
		addons: v.array(v.string()),
		essentialEditQuantity: v.optional(v.string()),
		clipsPackageQuantity: v.optional(v.string()),
		notes: v.optional(v.string())
	},
	handler: (ctx, args) => createPendingSessionHandler(ctx, args)
});

function createPendingSessionHandler(ctx: MutationCtx, args: CreatePendingSessionArgs) {
	return createPendingSessionService(ctx, args).match(tupleOk, tupleErr);
}

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
	args: { bookingId: v.id("bookings"), stripeSessionId: v.string() },
	handler: async (ctx, args) => {
		return await ctx.db.patch(args.bookingId, { stripeSessionId: args.stripeSessionId });
	}
});

export const markSessionExpiredByStripeSessionId = internalMutation({
	args: { stripeSessionId: v.string() },
	handler: (ctx, args) => markSessionExpiredByStripeSessionIdHandler(ctx, args)
});

function markSessionExpiredByStripeSessionIdHandler(
	ctx: MutationCtx,
	args: { stripeSessionId: string }
) {
	return markSessionExpiredByStripeSessionIdService(ctx, args).match(tupleOk, tupleErr);
}

export const deletePendingSession = internalMutation({
	args: { bookingId: v.id("bookings"), stripeSessionId: v.string() },
	handler: (ctx, args) => deletePendingSessionHandler(ctx, args)
});

function deletePendingSessionHandler(
	ctx: MutationCtx,
	args: { bookingId: Doc<"bookings">["_id"]; stripeSessionId: string }
) {
	return deletePendingSessionService(ctx, args).match(tupleOk, tupleErr);
}
