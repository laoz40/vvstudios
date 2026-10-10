"use node";

import { v } from "convex/values";
import { action } from "#convex/_generated/server";
import { tupleErr, tupleOk } from "#/lib/result";
import { bookingDetailsFieldsValidator } from "#convex/booking/services/formValidators";
import {
	closeAbandonedPackageStripeCheckout,
	createPendingPackageForStripeCheckout,
	openEmbeddedPackageStripeCheckout,
	parsePackageCheckoutRequest,
	runPackageCheckoutSubmitRateLimit
} from "#convex/packages/services/checkoutSession";
import {
	loadPaidPackageForEmailResend,
	refreshPackageScheduleLinkForResend,
	sendPackagePaidScheduleEmail
} from "#convex/packages/services/paidEmailResend";

export const createPackageCheckoutSession = action({
	args: {
		...bookingDetailsFieldsValidator,
		packageSize: v.union(v.literal(4), v.literal(8), v.literal(12))
	},
	handler: async (ctx, args) => {
		return await parsePackageCheckoutRequest(args)
			.andThen((packageRequest) => runPackageCheckoutSubmitRateLimit(ctx, packageRequest))
			.andThen((validRequest) => createPendingPackageForStripeCheckout(ctx, validRequest))
			.andThen((checkoutDraft) => openEmbeddedPackageStripeCheckout(ctx, checkoutDraft))
			.match(tupleOk, tupleErr);
	}
});

export const closeEmbeddedPackageCheckoutSession = action({
	args: { packageId: v.id("packages"), stripeSessionId: v.string() },
	handler: async (ctx, args) =>
		await closeAbandonedPackageStripeCheckout(ctx, args).match(tupleOk, tupleErr)
});

export const resendPackageEmail = action({
	args: { packageId: v.id("packages") },
	handler: async (ctx, args) =>
		await loadPaidPackageForEmailResend(ctx, args)
			.andThen(() => refreshPackageScheduleLinkForResend(ctx, args.packageId))
			.andThen((tokenResult) =>
				sendPackagePaidScheduleEmail(ctx, { packageId: args.packageId, tokenResult })
			)
			.match(tupleOk, tupleErr)
});
