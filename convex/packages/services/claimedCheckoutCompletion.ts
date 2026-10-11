"use node";

import { queryBookingAvailabilitySettings } from "#convex/booking/lib/settingsIo";

import type { Id } from "#convex/_generated/dataModel";
import type { ActionCtx } from "#convex/_generated/server";
import { env } from "#convex/env";
import { markPackagePaid } from "#convex/packages/lib/payment";
import type { PaidPackageResult } from "#convex/packages/lib/payment";
import {
	checkoutReturnOrigin,
	type ClaimedCheckoutEmailContext
} from "#convex/packages/lib/checkoutCompletion";
import {
	sendPackageCheckoutPaidEmails,
	type PackagePaidEmailError
} from "#convex/packages/services/paidEmailSend";

type CompleteClaimedPackageCheckoutSuccess = { outcome: "completed" };

type CompleteClaimedPackageCheckoutError =
	| PackagePaidEmailError
	| { reason: "PACKAGE_ALREADY_PAID" };

function markPackagePaidWithCheckoutContext(
	ctx: ActionCtx,
	packageId: Id<"packages">,
	context: Omit<ClaimedCheckoutEmailContext, "paymentResult">
) {
	return markPackagePaid(ctx, packageId, Date.now()).map((paymentResult: PaidPackageResult) => ({
		...context,
		paymentResult
	}));
}

export function completeClaimedPackageCheckoutAfterPayment(
	ctx: ActionCtx,
	packageId: Id<"packages">
) {
	return queryBookingAvailabilitySettings(ctx)
		.map((bookingSettings) => ({
			bookingSettings,
			checkoutReturnOrigin: checkoutReturnOrigin(env.STRIPE_CHECKOUT_RETURN_URL)
		}))
		.andThen((context: Omit<ClaimedCheckoutEmailContext, "paymentResult">) =>
			markPackagePaidWithCheckoutContext(ctx, packageId, context)
		)
		.andThen(({ bookingSettings, checkoutReturnOrigin: checkoutOrigin, paymentResult }) =>
			sendPackageCheckoutPaidEmails(
				ctx,
				packageId,
				paymentResult,
				bookingSettings.leadTimeMinutes,
				checkoutOrigin
			)
		)
		.map(() => ({ outcome: "completed" as const }));
}

export type { CompleteClaimedPackageCheckoutError, CompleteClaimedPackageCheckoutSuccess };
