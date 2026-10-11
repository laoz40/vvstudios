import { okAsync, ResultAsync } from "neverthrow";
import type { PackageAdjustmentInvoiceInput } from "#studio/features/booking-invoice/lib/booking-artifacts";
import type { Doc, Id } from "#convex/_generated/dataModel";
import type { MutationCtx } from "#convex/_generated/server";
import {
	patchPackageAdjustmentInvoiceEmailClaimed,
	patchPackageAdjustmentInvoiceEmailSent,
	patchPackageAdjustmentPaymentStatus,
	requirePackageAdjustmentPaymentEligibility,
	requirePackageAdjustmentInvoiceRowFromLookup,
	validatePackageAdjustmentEmailClaim,
	type PackageAdjustmentEmailClaim
} from "#convex/packages/lib/adjustments";
import { type PackageAdjustmentInvoicePaymentClaim } from "#convex/packages/lib/adjustmentInvoicePayment";
import { archivePackageWhenFullyDone } from "#convex/packages/services/archive";
import { getPackageAdjustmentInvoice } from "#convex/packages/services/adjustments";
import { getPackageFromDb } from "#convex/packages/services/lookup";
import { recordPackageAdjustmentStripeInvoice } from "#convex/stripe/services/invoiceMutations";
import { requirePermission } from "#convex/shared/services/auth";
import {
	adjustmentStripeInvoiceRecordArgs,
	selectAdjustmentEmailsForClaim,
	patchStalledAdjustmentEmail,
	lookupPackageAdjustmentForPayment,
	scheduleStalledAdjustmentEmailFailure,
	claimPackageAdjustmentPayment,
	patchClaimedAdjustmentEmailFailure
} from "#convex/packages/lib/adjustmentInvoiceEmail";

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

function claimAdjustmentInvoiceEmail(
	ctx: MutationCtx,
	args: ClaimPackageAdjustmentInvoiceEmailArgs,

	{
		adjustment,
		packageRecord
	}: { adjustment: PackageAdjustmentInvoiceRow; packageRecord: Doc<"packages"> }
) {
	return patchPackageAdjustmentInvoiceEmailClaimed(ctx, adjustment._id, args.now)
		.andThen(() => scheduleStalledAdjustmentEmailFailure(ctx, args.adjustmentId, args.now))
		.map(() => ({ adjustment, packageRecord }));
}

function recordAdjustmentStripeInvoiceAfterSent(
	ctx: MutationCtx,
	args: ClaimedPackageAdjustmentInvoiceEmailArgs & { stripeInvoiceId: string },
	adjustment: PackageAdjustmentInvoiceRow,

	result: { updated: boolean }
) {
	return recordPackageAdjustmentStripeInvoice(
		ctx,
		adjustmentStripeInvoiceRecordArgs(adjustment, args.stripeInvoiceId)
	).map(() => result);
}

function writeSentAdjustmentInvoice(
	ctx: MutationCtx,
	args: ClaimedPackageAdjustmentInvoiceEmailArgs & { stripeInvoiceId: string },
	adjustment: PackageAdjustmentInvoiceRow
) {
	return patchPackageAdjustmentInvoiceEmailSent(ctx, adjustment._id, args.stripeInvoiceId).andThen(
		(result: { updated: boolean }) =>
			recordAdjustmentStripeInvoiceAfterSent(ctx, args, adjustment, result)
	);
}

function writeSentAdjustmentInvoiceWhenClaimMatches(
	ctx: MutationCtx,
	args: ClaimedPackageAdjustmentInvoiceEmailArgs & { stripeInvoiceId: string },
	adjustment: PackageAdjustmentInvoiceRow
) {
	return ResultAsync.combine(
		selectAdjustmentEmailsForClaim(adjustment, args.claimedAt).map((claimed) =>
			writeSentAdjustmentInvoice(ctx, args, claimed)
		)
	).map((results) => results[0] ?? { updated: false });
}

function patchAdjustmentPaymentStatusForAdmin(
	ctx: MutationCtx,
	paid: boolean,
	adjustment: PackageAdjustmentInvoiceRow
) {
	return patchPackageAdjustmentPaymentStatus(ctx, adjustment._id, paid ? "paid" : "unpaid").map(
		() => adjustment
	);
}

export function claimPackageAdjustmentInvoiceEmail(
	ctx: MutationCtx,
	args: ClaimPackageAdjustmentInvoiceEmailArgs
): ResultAsync<PackageAdjustmentInvoiceInput, ClaimPackageAdjustmentInvoiceEmailError> {
	return getPackageAdjustmentInvoice(ctx, args.adjustmentId)
		.andThen((adjustment: PackageAdjustmentInvoiceRow) =>
			validatePackageAdjustmentEmailClaim(adjustment, args)
		)
		.andThen((adjustment: PackageAdjustmentInvoiceRow) =>
			getPackageFromDb(ctx, adjustment.packageId).map((packageRecord: Doc<"packages">) => ({
				adjustment,
				packageRecord
			}))
		)
		.andThen((_value) => claimAdjustmentInvoiceEmail(ctx, args, _value));
}

export function markStalledPackageAdjustmentInvoiceEmailFailed(
	ctx: MutationCtx,
	args: ClaimedPackageAdjustmentInvoiceEmailArgs
) {
	return getPackageAdjustmentInvoice(ctx, args.adjustmentId)
		.orElse(() => okAsync(null))
		.andThen((adjustment: PackageAdjustmentInvoiceRow | null) =>
			patchStalledAdjustmentEmail(ctx, adjustment, args.claimedAt)
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
			patchClaimedAdjustmentEmailFailure(ctx, adjustment, args.claimedAt)
	);
}

export function claimPackageAdjustmentInvoicePaymentAndArchive(
	ctx: MutationCtx,
	args: { stripeInvoiceId: string; adjustmentId?: string; paidAt: number }
) {
	return lookupPackageAdjustmentForPayment(ctx, args)
		.andThen(requirePackageAdjustmentInvoiceRowFromLookup)
		.andThen((adjustment) => claimPackageAdjustmentPayment(ctx, args, adjustment))
		.andThen((claim: PackageAdjustmentInvoicePaymentClaim) =>
			archivePackageWhenFullyDone(
				ctx,
				claim.outcome === "completed" ? claim.packageId : null,
				args.paidAt
			).map(() => claim)
		);
}

export function updatePackageAdjustmentPaymentStatusFromAdmin(
	ctx: MutationCtx,
	args: MarkPackageAdjustmentPaymentStatusArgs
) {
	return requirePermission(ctx, "update:payment-status")
		.andThen(() => getPackageAdjustmentInvoice(ctx, args.adjustmentId))
		.andThen((adjustment) => requirePackageAdjustmentPaymentEligibility(adjustment, Date.now()))
		.andThen((adjustment: PackageAdjustmentInvoiceRow) =>
			patchAdjustmentPaymentStatusForAdmin(ctx, args.paid, adjustment)
		)
		.andThen((updatedAdjustment: PackageAdjustmentInvoiceRow) =>
			archivePackageWhenFullyDone(ctx, args.paid ? updatedAdjustment.packageId : null)
		);
}
