"use node";

import { v } from "convex/values";
import { ok, safeTry } from "neverthrow";
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
		return await safeTry(async function* () {
			const packageRequest = yield* parsePackageCheckoutRequest(args);
			const validRequest = yield* runPackageCheckoutSubmitRateLimit(ctx, packageRequest);
			const checkoutDraft = yield* createPendingPackageForStripeCheckout(ctx, validRequest);
			const checkout = yield* openEmbeddedPackageStripeCheckout(ctx, checkoutDraft);

			return ok(checkout);
		}).match(tupleOk, tupleErr);
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
		await safeTry(async function* () {
			yield* loadPaidPackageForEmailResend(ctx, args);
			const tokenResult = yield* refreshPackageScheduleLinkForResend(ctx, args.packageId);

			const result = yield* sendPackagePaidScheduleEmail(ctx, {
				packageId: args.packageId,
				tokenResult
			});

			return ok(result);
		}).match(tupleOk, tupleErr)
});
