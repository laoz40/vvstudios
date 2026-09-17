import { errAsync, ResultAsync } from "neverthrow";
import { internal } from "#convex/_generated/api";
import type { Doc, Id } from "#convex/_generated/dataModel";
import type { ActionCtx } from "#convex/_generated/server";
import type { PackageLookupError, PaidPackageResult } from "#convex/services/packages";
import { calculatePackageAmounts } from "#studio/features/booking-form/lib/booking-pricing";
import { createPackageInvoiceLineItemSnapshot } from "#studio/features/booking-invoice/lib/build-booking-invoice-data";
import type { PackageInvoiceInput } from "#convex/lib/bookingInvoiceArtifacts";
import { sendPackageReceiptEmailsForPackage } from "#convex/lib/bookingDocumentEmails";
import type { ParsedPackageRequest } from "#convex/lib/packageUpdates";
import { fromConvexTuple, okOrThrow } from "#convex/lib/result";

type PackageScheduleEmailResult = ResultAsync<
	null,
	{ reason: "PACKAGE_NOT_FOUND" } | { reason: "PACKAGE_SCHEDULE_EMAIL_FAILED" }
>;

export type PackagePaidEmailContext = {
	expiresAt: number;
	leadTimeMinutes: number;
	packageRecord: Doc<"packages">;
	paidAt: number;
	scheduleUrl: string;
};

export function buildPackageScheduleUrl(baseUrl: string, token: string) {
	const url = new URL(`/package-schedule/${encodeURIComponent(token)}`, baseUrl);

	return url.toString();
}

export function createPendingPackage(
	ctx: ActionCtx,
	args: ParsedPackageRequest
): ResultAsync<PackageInvoiceInput, never> {
	const amounts = calculatePackageAmounts(args);

	const invoiceLineItems = createPackageInvoiceLineItemSnapshot({
		addons: args.addons,
		clipsPackageQuantity: args.clipsPackageQuantity || undefined,
		completeEditQuantity: args.completeEditQuantity || undefined,
		discountAmount: amounts.discountAmount,
		discountPercent: amounts.discountPercent,
		duration: args.duration,
		essentialEditQuantity: args.essentialEditQuantity || undefined,
		handcraftedClipsQuantity: args.handcraftedClipsQuantity || undefined,
		packageSize: args.packageSize
	});

	return okOrThrow(
		ctx.runMutation(internal.packages.createPendingPackage, {
			...args,
			abn: args.abn || undefined,
			clipsPackageQuantity: args.clipsPackageQuantity || undefined,
			completeEditQuantity: args.completeEditQuantity || undefined,
			essentialEditQuantity: args.essentialEditQuantity || undefined,
			handcraftedClipsQuantity: args.handcraftedClipsQuantity || undefined,
			notes: args.notes || undefined,
			...amounts,
			invoiceLineItems
		})
	).map((createResult) => createResult.packageRecord);
}

export function refreshPackageScheduleToken(ctx: ActionCtx, packageId: Id<"packages">) {
	return fromConvexTuple(
		ctx.runMutation(internal.packages.refreshPackageScheduleToken, { packageId })
	);
}

export function markPackagePaid(
	ctx: ActionCtx,
	packageId: Id<"packages">,
	paidAt: number
): ResultAsync<PaidPackageResult, PackageLookupError | { reason: "PACKAGE_ALREADY_PAID" }> {
	return fromConvexTuple(
		ctx.runMutation(internal.packages.markPackagePaidAndCreateScheduleToken, { packageId, paidAt })
	);
}

export function buildPackagePaidEmailContext(
	paymentResult: PaidPackageResult,
	leadTimeMinutes: number,
	origin: string
): PackagePaidEmailContext {
	return {
		expiresAt: paymentResult.expiresAt,
		leadTimeMinutes,
		packageRecord: paymentResult.packageRecord,
		paidAt: paymentResult.paidAt,
		scheduleUrl: buildPackageScheduleUrl(origin, paymentResult.token)
	};
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
		.orElse((error) =>
			recordPackagePaidEmailAttempt(ctx, packageId, "failed", error.reason).andThen(() =>
				errAsync({ reason: "PACKAGE_SCHEDULE_EMAIL_FAILED" as const })
			)
		);
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
		).andThen(() => recordPackageScheduleEmailAttempt(ctx, packageId, "sent"));
	}

	return recordPackageReceiptEmailAttempt(
		ctx,
		packageId,
		"failed",
		receiptNumberOrFailureCode
	).andThen(() => recordPackageScheduleEmailAttempt(ctx, packageId, "failed"));
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
