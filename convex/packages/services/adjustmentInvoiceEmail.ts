import { okAsync, ResultAsync, type ResultAsync as ResultAsyncType, ok, safeTry } from "neverthrow";
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
): ResultAsyncType<PackageAdjustmentInvoiceInput, ClaimPackageAdjustmentInvoiceEmailError> {
	return safeTry(async function* () {
		yield* patchPackageAdjustmentInvoiceEmailClaimed(ctx, adjustment._id, args.now);
		yield* scheduleStalledAdjustmentEmailFailure(ctx, args.adjustmentId, args.now);

		return ok({ adjustment, packageRecord });
	});
}

function recordAdjustmentStripeInvoiceAfterSent(
	ctx: MutationCtx,
	args: ClaimedPackageAdjustmentInvoiceEmailArgs & { stripeInvoiceId: string },
	adjustment: PackageAdjustmentInvoiceRow,

	result: { updated: boolean }
) {
	return safeTry(async function* () {
		yield* recordPackageAdjustmentStripeInvoice(
			ctx,
			adjustmentStripeInvoiceRecordArgs(adjustment, args.stripeInvoiceId)
		);

		return ok(result);
	});
}

function writeSentAdjustmentInvoice(
	ctx: MutationCtx,
	args: ClaimedPackageAdjustmentInvoiceEmailArgs & { stripeInvoiceId: string },
	adjustment: PackageAdjustmentInvoiceRow
) {
	return safeTry(async function* () {
		const emailUpdate = yield* patchPackageAdjustmentInvoiceEmailSent(
			ctx,
			adjustment._id,
			args.stripeInvoiceId
		);

		const recordedInvoice = yield* recordAdjustmentStripeInvoiceAfterSent(
			ctx,
			args,
			adjustment,
			emailUpdate
		);

		return ok(recordedInvoice);
	});
}

function writeSentAdjustmentInvoiceWhenClaimMatches(
	ctx: MutationCtx,
	args: ClaimedPackageAdjustmentInvoiceEmailArgs & { stripeInvoiceId: string },
	adjustment: PackageAdjustmentInvoiceRow
) {
	return safeTry(async function* () {
		const updates = yield* ResultAsync.combine(
			selectAdjustmentEmailsForClaim(adjustment, args.claimedAt).map((claimed) =>
				writeSentAdjustmentInvoice(ctx, args, claimed)
			)
		);

		return ok(updates[0] ?? { updated: false });
	});
}

function patchAdjustmentPaymentStatusForAdmin(
	ctx: MutationCtx,
	paid: boolean,
	adjustment: PackageAdjustmentInvoiceRow
) {
	return safeTry(async function* () {
		yield* patchPackageAdjustmentPaymentStatus(ctx, adjustment._id, paid ? "paid" : "unpaid");

		return ok(adjustment);
	});
}

export function claimPackageAdjustmentInvoiceEmail(
	ctx: MutationCtx,
	args: ClaimPackageAdjustmentInvoiceEmailArgs
): ResultAsyncType<PackageAdjustmentInvoiceInput, ClaimPackageAdjustmentInvoiceEmailError> {
	return safeTry(async function* () {
		const adjustment = yield* getPackageAdjustmentInvoice(ctx, args.adjustmentId);
		const validClaim = yield* validatePackageAdjustmentEmailClaim(adjustment, args);
		const packageRecord = yield* getPackageFromDb(ctx, validClaim.packageId);

		const claimedInvoice = yield* claimAdjustmentInvoiceEmail(ctx, args, {
			adjustment: validClaim,
			packageRecord
		});

		return ok(claimedInvoice);
	});
}

export function markStalledPackageAdjustmentInvoiceEmailFailed(
	ctx: MutationCtx,
	args: ClaimedPackageAdjustmentInvoiceEmailArgs
) {
	return safeTry(async function* () {
		const adjustment = yield* getPackageAdjustmentInvoice(ctx, args.adjustmentId).orElse(() =>
			okAsync(null)
		);

		const failed = yield* patchStalledAdjustmentEmail(ctx, adjustment, args.claimedAt);

		return ok(failed);
	});
}

export function writePackageAdjustmentInvoiceEmailSent(
	ctx: MutationCtx,
	args: ClaimedPackageAdjustmentInvoiceEmailArgs & { stripeInvoiceId: string }
) {
	return safeTry(async function* () {
		const adjustment = yield* getPackageAdjustmentInvoice(ctx, args.adjustmentId);
		const update = yield* writeSentAdjustmentInvoiceWhenClaimMatches(ctx, args, adjustment);

		return ok(update);
	});
}

export function writePackageAdjustmentInvoiceEmailFailed(
	ctx: MutationCtx,
	args: ClaimedPackageAdjustmentInvoiceEmailArgs
) {
	return safeTry(async function* () {
		const adjustment = yield* getPackageAdjustmentInvoice(ctx, args.adjustmentId);
		const update = yield* patchClaimedAdjustmentEmailFailure(ctx, adjustment, args.claimedAt);

		return ok(update);
	});
}

export function claimPackageAdjustmentInvoicePaymentAndArchive(
	ctx: MutationCtx,
	args: { stripeInvoiceId: string; adjustmentId?: string; paidAt: number }
) {
	return safeTry(async function* () {
		const adjustmentLookup = yield* lookupPackageAdjustmentForPayment(ctx, args);
		const adjustment = yield* requirePackageAdjustmentInvoiceRowFromLookup(adjustmentLookup);
		const paymentClaim = yield* claimPackageAdjustmentPayment(ctx, args, adjustment);
		yield* archivePackageWhenFullyDone(
			ctx,
			paymentClaim.outcome === "completed" ? paymentClaim.packageId : null,
			args.paidAt
		);

		return ok(paymentClaim);
	});
}

export function updatePackageAdjustmentPaymentStatusFromAdmin(
	ctx: MutationCtx,
	args: MarkPackageAdjustmentPaymentStatusArgs
) {
	return safeTry(async function* () {
		yield* requirePermission(ctx, "update:payment-status");
		const adjustment = yield* getPackageAdjustmentInvoice(ctx, args.adjustmentId);

		const eligibleAdjustment = yield* requirePackageAdjustmentPaymentEligibility(
			adjustment,
			Date.now()
		);

		const updatedAdjustment = yield* patchAdjustmentPaymentStatusForAdmin(
			ctx,
			args.paid,
			eligibleAdjustment
		);

		const archiveResult = yield* archivePackageWhenFullyDone(
			ctx,
			args.paid ? updatedAdjustment.packageId : null
		);

		return ok(archiveResult);
	});
}
