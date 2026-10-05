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
} from "#convex/lib/packages/packageAdjustments";
import {
	claimPackageAdjustmentInvoicePayment,
	type PackageAdjustmentInvoicePaymentClaim
} from "#convex/lib/packages/packageAdjustmentInvoicePayment";
import { archivePackageWhenFullyDone } from "#convex/services/packages/packageArchive";
import { getPackageAdjustmentInvoice } from "#convex/services/packages/packageAdjustments";
import { getPackageFromDb } from "#convex/services/packages/packageLookup";
import { okOrThrow } from "#convex/lib/result";
import { recordPackageAdjustmentStripeInvoice } from "#convex/lib/stripe/stripeInvoices";
import { requirePermission } from "#convex/services/auth";
import { getCustomerAddonDisplayLabel } from "#studio/features/booking-form/lib/booking-form-model";

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

function attachPackageRecordToAdjustment(adjustment: PackageAdjustmentInvoiceRow) {
	return (packageRecord: Doc<"packages">) => ({ adjustment, packageRecord });
}

function loadPackageForAdjustment(ctx: MutationCtx) {
	return (adjustment: PackageAdjustmentInvoiceRow) =>
		getPackageFromDb(ctx, adjustment.packageId).map(attachPackageRecordToAdjustment(adjustment));
}

function scheduleStalledAdjustmentEmailFailure(
	ctx: MutationCtx,
	args: ClaimPackageAdjustmentInvoiceEmailArgs
) {
	return () =>
		okOrThrow(
			ctx.scheduler.runAfter(
				PACKAGE_ADJUSTMENT_EMAIL_CLAIM_TIMEOUT_MS,
				internal.packageAdjustments.markStalledPackageAdjustmentInvoiceEmailFailed,
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
	return () => ({ adjustment, packageRecord });
}

function claimAdjustmentInvoiceEmail(
	ctx: MutationCtx,
	args: ClaimPackageAdjustmentInvoiceEmailArgs
) {
	return ({
		adjustment,
		packageRecord
	}: {
		adjustment: PackageAdjustmentInvoiceRow;
		packageRecord: Doc<"packages">;
	}) =>
		patchPackageAdjustmentInvoiceEmailClaimed(ctx, adjustment._id, args.now)
			.andThen(scheduleStalledAdjustmentEmailFailure(ctx, args))
			.map(keepAdjustmentInvoiceClaimPair({ adjustment, packageRecord }));
}

function validateAdjustmentEmailClaim(args: ClaimPackageAdjustmentInvoiceEmailArgs) {
	return (adjustment: PackageAdjustmentInvoiceRow) =>
		validatePackageAdjustmentEmailClaim(adjustment, args);
}

function patchStalledAdjustmentEmailWhenClaimMatches(
	ctx: MutationCtx,
	args: ClaimedPackageAdjustmentInvoiceEmailArgs
) {
	return (adjustment: PackageAdjustmentInvoiceRow | null) => {
		if (
			!adjustment ||
			adjustment.invoiceEmailStatus !== "pending" ||
			adjustment.invoiceEmailClaimedAt !== args.claimedAt
		) {
			return ok(null);
		}

		return patchPackageAdjustmentInvoiceEmailFailed(ctx, adjustment._id);
	};
}

function recordAdjustmentStripeInvoiceAfterSent(
	ctx: MutationCtx,
	args: ClaimedPackageAdjustmentInvoiceEmailArgs & { stripeInvoiceId: string },
	adjustment: PackageAdjustmentInvoiceRow
) {
	return (result: { updated: boolean }) => {
		const remotePodcastLabel = getCustomerAddonDisplayLabel("Remote Podcast");

		return recordPackageAdjustmentStripeInvoice(ctx, {
			packageId: adjustment.packageId,
			packageAdjustmentId: adjustment._id,
			stripeInvoiceId: args.stripeInvoiceId,
			lineItems: [
				{
					description: `${remotePodcastLabel} (package adjustment)`,
					amount: adjustment.totalAmount
				}
			],
			totalAmount: adjustment.totalAmount
		}).map(keepValue(result));
	};
}

function keepValue<T>(value: T) {
	return () => value;
}

function writeSentAdjustmentInvoiceWhenClaimMatches(
	ctx: MutationCtx,
	args: ClaimedPackageAdjustmentInvoiceEmailArgs & { stripeInvoiceId: string }
) {
	return (adjustment: PackageAdjustmentInvoiceRow) => {
		if (adjustment.invoiceEmailClaimedAt !== args.claimedAt) {
			return ok({ updated: false });
		}

		return patchPackageAdjustmentInvoiceEmailSent(
			ctx,
			adjustment._id,
			args.stripeInvoiceId
		).andThen(recordAdjustmentStripeInvoiceAfterSent(ctx, args, adjustment));
	};
}

function markAdjustmentInvoiceEmailFailedWhenClaimMatches(
	ctx: MutationCtx,
	args: ClaimedPackageAdjustmentInvoiceEmailArgs
) {
	return (adjustment: PackageAdjustmentInvoiceRow) => {
		if (adjustment.invoiceEmailClaimedAt !== args.claimedAt) {
			return ok({ updated: false });
		}

		return patchPackageAdjustmentInvoiceEmailFailed(ctx, adjustment._id).map(
			toUpdatedAdjustmentInvoiceEmailFailed
		);
	};
}

function toUpdatedAdjustmentInvoiceEmailFailed() {
	return { updated: true as const };
}

function archivePackageAfterCompletedAdjustmentPayment(ctx: MutationCtx, paidAt: number) {
	return (claim: PackageAdjustmentInvoicePaymentClaim) => {
		if (claim.outcome !== "completed") {
			return okAsync(claim);
		}

		return archivePackageWhenFullyDone(ctx, claim.packageId, paidAt).map(keepValue(claim));
	};
}

function patchAdjustmentPaymentStatusForAdmin(ctx: MutationCtx, paid: boolean) {
	return (adjustment: PackageAdjustmentInvoiceRow) =>
		patchPackageAdjustmentPaymentStatus(ctx, adjustment._id, paid ? "paid" : "unpaid").map(
			keepValue(adjustment)
		);
}

function archivePackageAfterAdminPayment(ctx: MutationCtx, paid: boolean) {
	return (updatedAdjustment: PackageAdjustmentInvoiceRow) => {
		if (!paid) {
			return okAsync(null);
		}

		return archivePackageWhenFullyDone(ctx, updatedAdjustment.packageId);
	};
}

function loadAdjustmentInvoiceForAdmin(ctx: MutationCtx, adjustmentId: Id<"packageAdjustments">) {
	return () => getPackageAdjustmentInvoice(ctx, adjustmentId);
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
		.andThen(validateAdjustmentEmailClaim(args))
		.andThen(loadPackageForAdjustment(ctx))
		.andThen(claimAdjustmentInvoiceEmail(ctx, args));
}

export function markStalledPackageAdjustmentInvoiceEmailFailed(
	ctx: MutationCtx,
	args: ClaimedPackageAdjustmentInvoiceEmailArgs
) {
	return getPackageAdjustmentInvoice(ctx, args.adjustmentId)
		.orElse(recoverMissingAdjustmentInvoice)
		.andThen(patchStalledAdjustmentEmailWhenClaimMatches(ctx, args));
}

export function writePackageAdjustmentInvoiceEmailSent(
	ctx: MutationCtx,
	args: ClaimedPackageAdjustmentInvoiceEmailArgs & { stripeInvoiceId: string }
) {
	return getPackageAdjustmentInvoice(ctx, args.adjustmentId).andThen(
		writeSentAdjustmentInvoiceWhenClaimMatches(ctx, args)
	);
}

export function writePackageAdjustmentInvoiceEmailFailed(
	ctx: MutationCtx,
	args: ClaimedPackageAdjustmentInvoiceEmailArgs
) {
	return getPackageAdjustmentInvoice(ctx, args.adjustmentId).andThen(
		markAdjustmentInvoiceEmailFailedWhenClaimMatches(ctx, args)
	);
}

export function claimPackageAdjustmentInvoicePaymentAndArchive(
	ctx: MutationCtx,
	args: { stripeInvoiceId: string; adjustmentId?: string; paidAt: number }
) {
	return claimPackageAdjustmentInvoicePayment(ctx, args).andThen(
		archivePackageAfterCompletedAdjustmentPayment(ctx, args.paidAt)
	);
}

export function updatePackageAdjustmentPaymentStatusFromAdmin(
	ctx: MutationCtx,
	args: MarkPackageAdjustmentPaymentStatusArgs
) {
	return requirePermission(ctx, "update:payment-status")
		.andThen(loadAdjustmentInvoiceForAdmin(ctx, args.adjustmentId))
		.andThen(validateAdjustmentPaymentEligibility)
		.andThen(patchAdjustmentPaymentStatusForAdmin(ctx, args.paid))
		.andThen(archivePackageAfterAdminPayment(ctx, args.paid));
}
