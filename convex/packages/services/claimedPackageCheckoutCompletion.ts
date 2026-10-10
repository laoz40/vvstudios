"use node";

import { api } from "#convex/_generated/api";
import type { Id } from "#convex/_generated/dataModel";
import type { ActionCtx } from "#convex/_generated/server";
import { env } from "#convex/env";
import { markPackagePaid } from "#convex/packages/lib/packagePayment";
import type { PaidPackageResult } from "#convex/packages/lib/packagePayment";
import {
	sendPackageCheckoutPaidEmails,
	type PackagePaidEmailError
} from "#convex/packages/services/packagePaidEmailSend";
import { okOrThrow } from "#convex/shared/lib/result";
import type { BookingAvailabilitySettings } from "#studio/lib/bookingAvailabilitySettings";

type CompleteClaimedPackageCheckoutSuccess = { outcome: "completed" };

type CompleteClaimedPackageCheckoutError =
	| PackagePaidEmailError
	| { reason: "PACKAGE_ALREADY_PAID" };

type ClaimedCheckoutEmailContext = {
	bookingSettings: BookingAvailabilitySettings;
	checkoutReturnOrigin: string;
	paymentResult: PaidPackageResult;
};

function bookingSettingsWithCheckoutOrigin(bookingSettings: BookingAvailabilitySettings) {
	return { bookingSettings, checkoutReturnOrigin: new URL(env.STRIPE_CHECKOUT_RETURN_URL).origin };
}

function attachPaymentResultToCheckoutContext(
	context: Omit<ClaimedCheckoutEmailContext, "paymentResult">,

	paymentResult: PaidPackageResult
) {
	return { ...context, paymentResult };
}

function markPackagePaidWithCheckoutContext(
	ctx: ActionCtx,
	packageId: Id<"packages">,
	context: Omit<ClaimedCheckoutEmailContext, "paymentResult">
) {
	return markPackagePaid(ctx, packageId, Date.now()).map((paymentResult: PaidPackageResult) =>
		attachPaymentResultToCheckoutContext(context, paymentResult)
	);
}

function sendPaidEmailsFromCheckoutContext(
	ctx: ActionCtx,
	packageId: Id<"packages">,
	{ bookingSettings, checkoutReturnOrigin, paymentResult }: ClaimedCheckoutEmailContext
) {
	return sendPackageCheckoutPaidEmails(
		ctx,
		packageId,
		paymentResult,
		bookingSettings.leadTimeMinutes,
		checkoutReturnOrigin
	);
}

function completedClaimedCheckoutOutcome() {
	return { outcome: "completed" as const };
}

export function completeClaimedPackageCheckoutAfterPayment(
	ctx: ActionCtx,
	packageId: Id<"packages">
) {
	return okOrThrow<BookingAvailabilitySettings>(ctx.runQuery(api.booking.settings.get, {}))
		.map(bookingSettingsWithCheckoutOrigin)
		.andThen((context: Omit<ClaimedCheckoutEmailContext, "paymentResult">) =>
			markPackagePaidWithCheckoutContext(ctx, packageId, context)
		)
		.andThen((_value) => sendPaidEmailsFromCheckoutContext(ctx, packageId, _value))
		.map(() => completedClaimedCheckoutOutcome());
}

export type { CompleteClaimedPackageCheckoutError, CompleteClaimedPackageCheckoutSuccess };
