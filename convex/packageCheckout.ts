import { v } from "convex/values";
import { tupleErr, tupleOk } from "#/lib/result";
import { internalMutation, internalQuery, query } from "#convex/_generated/server";
import {
	abandonPendingPackageCheckout,
	claimPackageCheckoutPayment as runClaimPackageCheckoutPayment,
	expirePendingPackageByStripeSessionId,
	loadPackageRowByStripeSessionId,
	loadPublicPackageStatusByStripeSessionId,
	writePackageStripeCheckoutIds
} from "#convex/services/packages/packageCheckoutMutations";

export const setPackageStripeSessionId = internalMutation({
	args: { packageId: v.id("packages"), stripeSessionId: v.string(), stripeCustomerId: v.string() },
	handler: (ctx, args) => writePackageStripeCheckoutIds(ctx, args).match(tupleOk, tupleErr)
});

export const claimPackageCheckoutPayment = internalMutation({
	args: {
		packageId: v.string(),
		stripeSessionId: v.string(),
		originalPaidAmount: v.optional(v.number()),
		stripePaymentIntentId: v.optional(v.string())
	},
	handler: (ctx, args) => runClaimPackageCheckoutPayment(ctx, args).match(tupleOk, tupleErr)
});

export const abandonPendingPackage = internalMutation({
	args: { packageId: v.id("packages"), stripeSessionId: v.string() },
	handler: (ctx, args) => abandonPendingPackageCheckout(ctx, args).match(tupleOk, tupleErr)
});

export const markPackageExpiredByStripeSessionId = internalMutation({
	args: { stripeSessionId: v.string() },
	handler: (ctx, args) =>
		expirePendingPackageByStripeSessionId(ctx, args.stripeSessionId).match(tupleOk, tupleErr)
});

export const getPackageByStripeSessionId = internalQuery({
	args: { stripeSessionId: v.string() },
	handler: async (ctx, args) =>
		(await loadPackageRowByStripeSessionId(ctx, args.stripeSessionId)).match(
			(packageFromDb) => packageFromDb,
			() => null
		)
});

export const getPackageStatusByStripeSessionId = query({
	args: { stripeSessionId: v.string() },
	handler: async (ctx, args) =>
		(await loadPublicPackageStatusByStripeSessionId(ctx, args.stripeSessionId)).match(
			(status) => status,
			() => null
		)
});
