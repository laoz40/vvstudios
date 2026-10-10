import { ok, okAsync, type ResultAsync } from "neverthrow";
import type { PackageAdjustmentInvoiceInput } from "#studio/features/booking-invoice/lib/booking-artifacts";
import { internal } from "#convex/_generated/api";
import type { Doc, Id } from "#convex/_generated/dataModel";
import type { MutationCtx } from "#convex/_generated/server";
import {
	patchPackageAdjustmentInvoiceEmailClaimed,
	patchPackageAdjustmentInvoiceEmailFailed,
	patchPackageAdjustmentInvoiceEmailSent,
	patchPackageAdjustmentPaymentStatus,
	requirePackageAdjustmentPaymentEligibility,
	validatePackageAdjustmentEmailClaim,
	PACKAGE_ADJUSTMENT_EMAIL_CLAIM_TIMEOUT_MS,
	type PackageAdjustmentEmailClaim
} from "#convex/packages/lib/packageAdjustments";
import {
	claimPackageAdjustmentInvoicePayment,
	type PackageAdjustmentInvoicePaymentClaim
} from "#convex/packages/lib/packageAdjustmentInvoicePayment";
import { archivePackageWhenFullyDone } from "#convex/packages/services/packageArchive";
import { getPackageAdjustmentInvoice } from "#convex/packages/services/packageAdjustments";
import { getPackageFromDb } from "#convex/packages/services/packageLookup";
import { okOrThrow } from "#convex/shared/lib/result";
import { recordPackageAdjustmentStripeInvoice } from "#convex/stripe/lib/stripeInvoices";
import { requirePermission } from "#convex/shared/services/auth";
import { getCustomerAddonDisplayLabel } from "#/domain/booking/catalog";

export type ClaimPackageAdjustmentInvoiceEmailArgs = PackageAdjustmentEmailClaim & {
	adjustmentId: Id<"packageAdjustments">;
};

type ClaimedPackageAdjustmentInvoiceEmailArgs = {
	adjustmentId: Id<"packageAdjustments">;
	claimedAt: number;
	stripeInvoiceId?: string;
};

type MarkPackageAdjustmentPaymentStatusArgs = {
	adjustmentId: Id<"packageAdjustments">;
	paid: boolean;
};

type ClaimPackageAdjustmentInvoiceEmailError =
	| { reason: "PACKAGE_ADJUSTMENT_NOT_FOUND" }
	| { reason: "PACKAGE_ADJUSTMENT_EMAIL_NOT_SENDABLE" }
	| { reason: "PACKAGE_NOT_FOUND" };

type PackageAdjustmentInvoiceRow = PackageAdjustmentInvoiceInput["adjustment"];

function attachPackageRecordToAdjustment(
	adjustment: PackageAdjustmentInvoiceRow,
	packageRecord: Doc<"packages">
) {
	return { adjustment, packageRecord };
}

function loadPackageForAdjustment(ctx: MutationCtx, adjustment: PackageAdjustmentInvoiceRow) {
	return getPackageFromDb(ctx, adjustment.packageId).map((packageRecord: Doc<"packages">) =>
		attachPackageRecordToAdjustment(adjustment, packageRecord)
	);
}

function scheduleStalledAdjustmentEmailFailure(
	ctx: MutationCtx,
	args: ClaimPackageAdjustmentInvoiceEmailArgs
) {
	return okOrThrow(
		ctx.scheduler.runAfter(
			PACKAGE_ADJUSTMENT_EMAIL_CLAIM_TIMEOUT_MS,
			internal.packages.packageAdjustments.markStalledPackageAdjustmentInvoiceEmailFailed,
			{ adjustmentId: args.adjustmentId, claimedAt: args.now }
		)
	);
}

function keepAdjustmentInvoiceClaimPair({
	adjustment,
	packageRecord
}: {
	adjustment: PackageAdjustmentInvoiceRow;
	packageRecord: Doc<"packages">;
}) {
	return { adjustment, packageRecord };
}

function claimAdjustmentInvoiceEmail(
	ctx: MutationCtx,
	args: ClaimPackageAdjustmentInvoiceEmailArgs,

	{
		adjustment,
		packageRecord
	}: { adjustment: PackageAdjustmentInvoiceRow; packageRecord: Doc<"packages"> }
) {
	return patchPackageAdjustmentInvoiceEmailClaimed(ctx, adjustment._id, args.now)
		.andThen(() => scheduleStalledAdjustmentEmailFailure(ctx, args))
		.map(() => keepAdjustmentInvoiceClaimPair({ adjustment, packageRecord }));
}

function validateAdjustmentEmailClaim(
	args: ClaimPackageAdjustmentInvoiceEmailArgs,
	adjustment: PackageAdjustmentInvoiceRow
) {
	return validatePackageAdjustmentEmailClaim(adjustment, args);
}

function patchStalledAdjustmentEmailWhenClaimMatches(
	ctx: MutationCtx,
	args: ClaimedPackageAdjustmentInvoiceEmailArgs,

	adjustment: PackageAdjustmentInvoiceRow | null
) {
	if (
		!adjustment ||
		adjustment.invoiceEmailStatus !== "pending" ||
		adjustment.invoiceEmailClaimedAt !== args.claimedAt
	) {
		return ok(null);
	}

	return patchPackageAdjustmentInvoiceEmailFailed(ctx, adjustment._id);
}

function recordAdjustmentStripeInvoiceAfterSent(
	ctx: MutationCtx,
	args: ClaimedPackageAdjustmentInvoiceEmailArgs & { stripeInvoiceId: string },
	adjustment: PackageAdjustmentInvoiceRow,

	result: { updated: boolean }
) {
	const remotePodcastLabel = getCustomerAddonDisplayLabel("Remote Podcast");

	return recordPackageAdjustmentStripeInvoice(ctx, {
		packageId: adjustment.packageId,
		packageAdjustmentId: adjustment._id,
		stripeInvoiceId: args.stripeInvoiceId,
		lineItems: [
			{ description: `${remotePodcastLabel} (package adjustment)`, amount: adjustment.totalAmount }
		],

		totalAmount: adjustment.totalAmount
	}).map(() => keepValue(result));
}

function keepValue<T>(value: T) {
	return value;
}

function writeSentAdjustmentInvoiceWhenClaimMatches(
	ctx: MutationCtx,
	args: ClaimedPackageAdjustmentInvoiceEmailArgs & { stripeInvoiceId: string },

	adjustment: PackageAdjustmentInvoiceRow
) {
	if (adjustment.invoiceEmailClaimedAt !== args.claimedAt) {
		return ok({ updated: false });
	}

	return patchPackageAdjustmentInvoiceEmailSent(ctx, adjustment._id, args.stripeInvoiceId).andThen(
		(result: { updated: boolean }) =>
			recordAdjustmentStripeInvoiceAfterSent(ctx, args, adjustment, result)
	);
}

function markAdjustmentInvoiceEmailFailedWhenClaimMatches(
	ctx: MutationCtx,
	args: ClaimedPackageAdjustmentInvoiceEmailArgs,

	adjustment: PackageAdjustmentInvoiceRow
) {
	if (adjustment.invoiceEmailClaimedAt !== args.claimedAt) {
		return ok({ updated: false });
	}

	return patchPackageAdjustmentInvoiceEmailFailed(ctx, adjustment._id).map(
		toUpdatedAdjustmentInvoiceEmailFailed
	);
}

function toUpdatedAdjustmentInvoiceEmailFailed() {
	return { updated: true as const };
}

function archivePackageAfterCompletedAdjustmentPayment(
	ctx: MutationCtx,
	paidAt: number,
	claim: PackageAdjustmentInvoicePaymentClaim
) {
	if (claim.outcome !== "completed") {
		return okAsync(claim);
	}

	return archivePackageWhenFullyDone(ctx, claim.packageId, paidAt).map(() => keepValue(claim));
}

function patchAdjustmentPaymentStatusForAdmin(
	ctx: MutationCtx,
	paid: boolean,
	adjustment: PackageAdjustmentInvoiceRow
) {
	return patchPackageAdjustmentPaymentStatus(ctx, adjustment._id, paid ? "paid" : "unpaid").map(
		() => keepValue(adjustment)
	);
}

function archivePackageAfterAdminPayment(
	ctx: MutationCtx,
	paid: boolean,
	updatedAdjustment: PackageAdjustmentInvoiceRow
) {
	if (!paid) {
		return okAsync(null);
	}

	return archivePackageWhenFullyDone(ctx, updatedAdjustment.packageId);
}

function loadAdjustmentInvoiceForAdmin(ctx: MutationCtx, adjustmentId: Id<"packageAdjustments">) {
	return getPackageAdjustmentInvoice(ctx, adjustmentId);
}

function validateAdjustmentPaymentEligibility(adjustment: PackageAdjustmentInvoiceRow) {
	return requirePackageAdjustmentPaymentEligibility(adjustment, Date.now());
}

function recoverMissingAdjustmentInvoice() {
	return ok(null);
}

export function claimPackageAdjustmentInvoiceEmail(
	ctx: MutationCtx,
	args: ClaimPackageAdjustmentInvoiceEmailArgs
): ResultAsync<PackageAdjustmentInvoiceInput, ClaimPackageAdjustmentInvoiceEmailError> {
	return getPackageAdjustmentInvoice(ctx, args.adjustmentId)
		.andThen((adjustment: PackageAdjustmentInvoiceRow) =>
			validateAdjustmentEmailClaim(args, adjustment)
		)
		.andThen((adjustment: PackageAdjustmentInvoiceRow) => loadPackageForAdjustment(ctx, adjustment))
		.andThen((_value) => claimAdjustmentInvoiceEmail(ctx, args, _value));
}

export function markStalledPackageAdjustmentInvoiceEmailFailed(
	ctx: MutationCtx,
	args: ClaimedPackageAdjustmentInvoiceEmailArgs
) {
	return getPackageAdjustmentInvoice(ctx, args.adjustmentId)
		.orElse(recoverMissingAdjustmentInvoice)
		.andThen((adjustment: PackageAdjustmentInvoiceRow | null) =>
			patchStalledAdjustmentEmailWhenClaimMatches(ctx, args, adjustment)
		);
}

export function writePackageAdjustmentInvoiceEmailSent(
	ctx: MutationCtx,
	args: ClaimedPackageAdjustmentInvoiceEmailArgs & { stripeInvoiceId: string }
) {
	return getPackageAdjustmentInvoice(ctx, args.adjustmentId).andThen(
		(adjustment: PackageAdjustmentInvoiceRow) =>
			writeSentAdjustmentInvoiceWhenClaimMatches(ctx, args, adjustment)
	);
}

export function writePackageAdjustmentInvoiceEmailFailed(
	ctx: MutationCtx,
	args: ClaimedPackageAdjustmentInvoiceEmailArgs
) {
	return getPackageAdjustmentInvoice(ctx, args.adjustmentId).andThen(
		(adjustment: PackageAdjustmentInvoiceRow) =>
			markAdjustmentInvoiceEmailFailedWhenClaimMatches(ctx, args, adjustment)
	);
}

export function claimPackageAdjustmentInvoicePaymentAndArchive(
	ctx: MutationCtx,
	args: { stripeInvoiceId: string; adjustmentId?: string; paidAt: number }
) {
	return claimPackageAdjustmentInvoicePayment(ctx, args).andThen(
		(claim: PackageAdjustmentInvoicePaymentClaim) =>
			archivePackageAfterCompletedAdjustmentPayment(ctx, args.paidAt, claim)
	);
}

export function updatePackageAdjustmentPaymentStatusFromAdmin(
	ctx: MutationCtx,
	args: MarkPackageAdjustmentPaymentStatusArgs
) {
	return requirePermission(ctx, "update:payment-status")
		.andThen(() => loadAdjustmentInvoiceForAdmin(ctx, args.adjustmentId))
		.andThen(validateAdjustmentPaymentEligibility)
		.andThen((adjustment: PackageAdjustmentInvoiceRow) =>
			patchAdjustmentPaymentStatusForAdmin(ctx, args.paid, adjustment)
		)
		.andThen((updatedAdjustment: PackageAdjustmentInvoiceRow) =>
			archivePackageAfterAdminPayment(ctx, args.paid, updatedAdjustment)
		);
}
