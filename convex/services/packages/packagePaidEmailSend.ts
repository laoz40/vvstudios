"use node";

import { errAsync, type ResultAsync } from "neverthrow";
import { internal } from "#convex/_generated/api";
import type { Id } from "#convex/_generated/dataModel";
import type { ActionCtx } from "#convex/_generated/server";
import { fromConvexTuple } from "#convex/lib/result";
import {
	buildPackagePaidEmailContext,
	type PackagePaidEmailContext,
	type PaidPackageResult
} from "#convex/lib/packages/packagePayment";
import {
	sendPackageReceiptEmailsForPackage,
	type PackageReceiptEmailError
} from "#convex/services/booking/bookingReceiptEmails";

export type PackagePaidEmailError = { reason: "PACKAGE_NOT_FOUND" } | PackageReceiptEmailError;

type PackageScheduleEmailResult = ResultAsync<null, PackagePaidEmailError>;

function recordSentPackagePaidEmail(
	ctx: ActionCtx,
	packageId: Id<"packages">,
	{ receiptNumber }: { receiptNumber: string }
) {
	return recordPackagePaidEmailAttempt(ctx, packageId, "sent", receiptNumber);
}

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
		.andThen((_value) => recordSentPackagePaidEmail(ctx, packageId, _value))
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
	if (status === "sent") {
		return recordPackageReceiptEmailAttempt(
			ctx,
			packageId,
			"sent",
			receiptNumberOrFailureCode
		).andThen(() => recordPackageScheduleEmailSentStep(ctx, packageId));
	}

	return recordPackageReceiptEmailAttempt(
		ctx,
		packageId,
		"failed",
		receiptNumberOrFailureCode
	).andThen(() => recordPackageScheduleEmailFailedStep(ctx, packageId));
}

function recordPackageScheduleEmailSentStep(ctx: ActionCtx, packageId: Id<"packages">) {
	return recordPackageScheduleEmailAttempt(ctx, packageId, "sent");
}

function recordPackageScheduleEmailFailedStep(ctx: ActionCtx, packageId: Id<"packages">) {
	return recordPackageScheduleEmailAttempt(ctx, packageId, "failed");
}

function recordPackageScheduleEmailAttempt(
	ctx: ActionCtx,
	packageId: Id<"packages">,
	status: "sent" | "failed"
): ResultAsync<null, { reason: "PACKAGE_NOT_FOUND" }> {
	return fromConvexTuple(
		ctx.runMutation(internal.packages.markPackageScheduleEmailAttempt, { packageId, status })
	);
}

function recordPackageReceiptEmailAttempt(
	ctx: ActionCtx,
	packageId: Id<"packages">,
	status: "sent" | "failed",
	receiptNumberOrFailureCode?: string
): ResultAsync<null, { reason: "PACKAGE_NOT_FOUND" }> {
	return fromConvexTuple(
		ctx.runMutation(internal.packages.markPackageReceiptEmailAttempt, {
			packageId,
			status,
			receiptNumber: status === "sent" ? receiptNumberOrFailureCode : undefined,
			failureCode: status === "failed" ? receiptNumberOrFailureCode : undefined
		})
	);
}
