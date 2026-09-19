import { v } from "convex/values";
import { tupleErr, tupleOk } from "#/lib/result";
import { internalMutation, internalQuery, query } from "#convex/_generated/server";
import {
	buildPublicPackageStatusResponse,
	claimPackageCheckoutPaymentService,
	deletePendingPackageService,
	markPackageExpiredByStripeSessionIdService
} from "#convex/services/packageCheckout";

export const setPackageStripeSessionId = internalMutation({
	args: { packageId: v.id("packages"), stripeSessionId: v.string(), stripeCustomerId: v.string() },
	handler: async (ctx, args) => {
		return await ctx.db.patch(args.packageId, {
			stripeSessionId: args.stripeSessionId,
			stripeCustomerId: args.stripeCustomerId
		});
	}
});

export const claimPackageCheckoutPayment = internalMutation({
	args: {
		packageId: v.string(),
		stripeSessionId: v.string(),
		stripePaymentIntentId: v.optional(v.string())
	},
	handler: (ctx, args) => claimPackageCheckoutPaymentService(ctx, args).match(tupleOk, tupleErr)
});

export const deletePendingPackage = internalMutation({
	args: { packageId: v.id("packages"), stripeSessionId: v.string() },
	handler: (ctx, args) => deletePendingPackageService(ctx, args).match(tupleOk, tupleErr)
});

export const markPackageExpiredByStripeSessionId = internalMutation({
	args: { stripeSessionId: v.string() },
	handler: (ctx, args) =>
		markPackageExpiredByStripeSessionIdService(ctx, args).match(tupleOk, tupleErr)
});

export const getPackageByStripeSessionId = internalQuery({
	args: { stripeSessionId: v.string() },
	handler: async (ctx, args) => {
		return await ctx.db
			.query("packages")
			.withIndex("by_stripeSessionId", (indexQuery) =>
				indexQuery.eq("stripeSessionId", args.stripeSessionId)
			)
			.unique();
	}
});

export const getPackageStatusByStripeSessionId = query({
	args: { stripeSessionId: v.string() },
	handler: async (ctx, args) => {
		const packageFromDb = await ctx.db
			.query("packages")
			.withIndex("by_stripeSessionId", (indexQuery) =>
				indexQuery.eq("stripeSessionId", args.stripeSessionId)
			)
			.unique();

		if (!packageFromDb) return null;

		return buildPublicPackageStatusResponse(packageFromDb);
	}
});
