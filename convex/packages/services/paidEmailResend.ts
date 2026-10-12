"use node";

import { queryBookingAvailabilitySettings } from "#convex/booking/lib/settingsIo";

import { type ResultAsync, ok, safeTry } from "neverthrow";

import type { Doc, Id } from "#convex/_generated/dataModel";
import type { ActionCtx } from "#convex/_generated/server";
import { env } from "#convex/env";
import { requirePermissionActions } from "#convex/shared/services/requirePermissionActions";
import {
	buildPackagePaidEmailContext,
	type PaidPackageResult,
	refreshPackageScheduleToken,
	validatePaidPackageForEmailResend
} from "#convex/packages/lib/payment";
import { checkoutReturnOrigin } from "#convex/packages/lib/checkoutCompletion";
import {
	sendAndRecordPackagePaidEmail,
	type PackagePaidEmailError
} from "#convex/packages/services/paidEmailSend";
import { getPackageForAction } from "#convex/packages/services/lookup";

export type ResendPackageEmailError =
	| { reason: "NOT_AUTHENTICATED" }
	| { reason: "NOT_AUTHORIZED" }
	| { reason: "PACKAGE_NOT_FOUND" }
	| { reason: "PACKAGE_NOT_PAID" }
	| { reason: "PACKAGE_SCHEDULE_EMAIL_NOT_RETRYABLE" }
	| { reason: "PACKAGE_SCHEDULE_LINK_NOT_READY" }
	| PackagePaidEmailError;

export function loadPaidPackageForEmailResend(
	ctx: ActionCtx,
	args: { packageId: Id<"packages"> }
): ResultAsync<{ paidAt: number; packageRecord: Doc<"packages"> }, ResendPackageEmailError> {
	return safeTry(async function* () {
		yield* requirePermissionActions(ctx, "send:receipt-emails");
		const packageRecord = yield* getPackageForAction(ctx, args.packageId);
		const paidPackage = yield* validatePaidPackageForEmailResend(packageRecord);

		return ok(paidPackage);
	});
}

export function refreshPackageScheduleLinkForResend(
	ctx: ActionCtx,
	packageId: Id<"packages">
): ResultAsync<PaidPackageResult, ResendPackageEmailError> {
	return refreshPackageScheduleToken(ctx, packageId);
}

export function sendPackagePaidScheduleEmail(
	ctx: ActionCtx,
	args: { packageId: Id<"packages">; tokenResult: PaidPackageResult }
): ResultAsync<null, ResendPackageEmailError> {
	return safeTry(async function* () {
		const bookingSettings = yield* queryBookingAvailabilitySettings(ctx);

		const emailResult = yield* sendAndRecordPackagePaidEmail(
			ctx,
			args.packageId,
			buildPackagePaidEmailContext(
				args.tokenResult,
				bookingSettings.leadTimeMinutes,
				checkoutReturnOrigin(env.STRIPE_CHECKOUT_RETURN_URL)
			)
		);

		return ok(emailResult);
	});
}
