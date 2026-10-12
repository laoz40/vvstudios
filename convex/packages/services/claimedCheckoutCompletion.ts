"use node";

import { ok, safeTry } from "neverthrow";

import { queryBookingAvailabilitySettings } from "#convex/booking/lib/settingsIo";

import type { Id } from "#convex/_generated/dataModel";
import type { ActionCtx } from "#convex/_generated/server";
import { env } from "#convex/env";
import { markPackagePaid } from "#convex/packages/lib/payment";
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
	return safeTry(async function* () {
		const paymentResult = yield* markPackagePaid(ctx, packageId, Date.now());

		return ok({ ...context, paymentResult });
	});
}

export function completeClaimedPackageCheckoutAfterPayment(
	ctx: ActionCtx,
	packageId: Id<"packages">
) {
	return safeTry(async function* () {
		const bookingSettings = yield* queryBookingAvailabilitySettings(ctx);

		const emailContext = {
			bookingSettings,
			checkoutReturnOrigin: checkoutReturnOrigin(env.STRIPE_CHECKOUT_RETURN_URL)
		};

		const paymentContext = yield* markPackagePaidWithCheckoutContext(ctx, packageId, emailContext);

		const {
			bookingSettings: loadedBookingSettings,
			checkoutReturnOrigin: checkoutOrigin,
			paymentResult
		} = paymentContext;

		yield* sendPackageCheckoutPaidEmails(
			ctx,
			packageId,
			paymentResult,
			loadedBookingSettings.leadTimeMinutes,
			checkoutOrigin
		);

		return ok({ outcome: "completed" as const });
	});
}

export type { CompleteClaimedPackageCheckoutError, CompleteClaimedPackageCheckoutSuccess };
