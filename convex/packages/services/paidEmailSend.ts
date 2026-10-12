"use node";

import { err, type ResultAsync, ok, safeTry } from "neverthrow";
import type { Id } from "#convex/_generated/dataModel";
import type { ActionCtx } from "#convex/_generated/server";
import {
	buildPackagePaidEmailContext,
	type PackagePaidEmailContext,
	type PaidPackageResult
} from "#convex/packages/lib/payment";
import {
	sendPackageReceiptEmailsForPackage,
	type PackageReceiptEmailError
} from "#convex/booking/services/receiptEmails";
import {
	recordPackageReceiptEmailAttempt,
	recordPackageScheduleEmailAttempt
} from "#convex/packages/lib/paidEmailSend";

export type PackagePaidEmailError = { reason: "PACKAGE_NOT_FOUND" } | PackageReceiptEmailError;

function recordFailedPackagePaidEmailAndFail(
	ctx: ActionCtx,
	packageId: Id<"packages">,
	error: PackagePaidEmailError
): ResultAsync<never, PackagePaidEmailError> {
	return safeTry(async function* () {
		yield* recordPackagePaidEmailAttempt(ctx, packageId, "failed", error.reason);

		return err(error);
	});
}

export function sendAndRecordPackagePaidEmail(
	ctx: ActionCtx,
	packageId: Id<"packages">,
	context: PackagePaidEmailContext
): ResultAsync<null, PackagePaidEmailError> {
	return safeTry(async function* () {
		const receipt = yield* sendPackageReceiptEmailsForPackage(
			context.packageRecord,
			context.paidAt,
			{
				expiresAt: context.expiresAt,
				leadTimeMinutes: context.leadTimeMinutes,
				scheduleUrl: context.scheduleUrl
			}
		);

		const { receiptNumber } = receipt;
		const update = yield* recordPackagePaidEmailAttempt(ctx, packageId, "sent", receiptNumber);

		return ok(update);
	}).orElse((error) => recordFailedPackagePaidEmailAndFail(ctx, packageId, error));
}

export function sendPackageCheckoutPaidEmails(
	ctx: ActionCtx,
	packageId: Id<"packages">,
	paymentResult: PaidPackageResult,
	leadTimeMinutes: number,
	checkoutReturnOrigin: string
) {
	return sendAndRecordPackagePaidEmail(
		ctx,
		packageId,
		buildPackagePaidEmailContext(paymentResult, leadTimeMinutes, checkoutReturnOrigin)
	);
}

function recordPackagePaidEmailAttempt(
	ctx: ActionCtx,
	packageId: Id<"packages">,
	status: "sent" | "failed",
	receiptNumberOrFailureCode?: string
): ResultAsync<null, { reason: "PACKAGE_NOT_FOUND" }> {
	return safeTry(async function* () {
		yield* recordPackageReceiptEmailAttempt(ctx, packageId, status, receiptNumberOrFailureCode);
		const update = yield* recordPackageScheduleEmailAttempt(ctx, packageId, status);

		return ok(update);
	});
}
