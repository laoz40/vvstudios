"use node";

import { errAsync, type ResultAsync } from "neverthrow";
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

type PackageScheduleEmailResult = ResultAsync<null, PackagePaidEmailError>;

function recordFailedPackagePaidEmailAndFail(
	ctx: ActionCtx,
	packageId: Id<"packages">,
	error: PackagePaidEmailError
) {
	return recordPackagePaidEmailAttempt(ctx, packageId, "failed", error.reason).andThen(() =>
		errAsync(error)
	);
}

export function sendAndRecordPackagePaidEmail(
	ctx: ActionCtx,
	packageId: Id<"packages">,
	context: PackagePaidEmailContext
): PackageScheduleEmailResult {
	return sendPackageReceiptEmailsForPackage(context.packageRecord, context.paidAt, {
		expiresAt: context.expiresAt,
		leadTimeMinutes: context.leadTimeMinutes,
		scheduleUrl: context.scheduleUrl
	})
		.andThen(({ receiptNumber }) =>
			recordPackagePaidEmailAttempt(ctx, packageId, "sent", receiptNumber)
		)
		.orElse((error) => recordFailedPackagePaidEmailAndFail(ctx, packageId, error));
}

export function sendPackageCheckoutPaidEmails(
	ctx: ActionCtx,
	packageId: Id<"packages">,
	paymentResult: PaidPackageResult,
	leadTimeMinutes: number,
	checkoutReturnOrigin: string
): PackageScheduleEmailResult {
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
	return recordPackageReceiptEmailAttempt(
		ctx,
		packageId,
		status,
		receiptNumberOrFailureCode
	).andThen(() => recordPackageScheduleEmailAttempt(ctx, packageId, status));
}
