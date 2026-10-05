import { ok, okAsync } from "neverthrow";
import { internal } from "#convex/_generated/api";
import type { Id } from "#convex/_generated/dataModel";
import type { MutationCtx } from "#convex/_generated/server";
import {
	getPackageAdjustmentInvoice,
	requirePackageAdjustmentPaymentEligibility,
	validatePackageAdjustmentEmailClaim,
	PACKAGE_ADJUSTMENT_EMAIL_CLAIM_TIMEOUT_MS,
	type PackageAdjustmentEmailClaim
} from "#convex/lib/packages/packageAdjustments";
import { claimPackageAdjustmentInvoicePayment } from "#convex/lib/packages/packageAdjustmentInvoicePayment";
import { archivePackageWhenFullyDone } from "#convex/lib/packages/packageArchive";
import { getPackageFromDb } from "#convex/lib/packages/packageLookup";
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

export function claimPackageAdjustmentInvoiceEmail(
	ctx: MutationCtx,
	args: ClaimPackageAdjustmentInvoiceEmailArgs
) {
	return getPackageAdjustmentInvoice(ctx, args.adjustmentId)
		.andThen((adjustment) => validatePackageAdjustmentEmailClaim(adjustment, args))
		.andThen((adjustment) =>
			getPackageFromDb(ctx, adjustment.packageId).map((packageRecord) => ({
				adjustment,
				packageRecord
			}))
		)
		.andThen(({ adjustment, packageRecord }) =>
			okOrThrow(
				ctx.db
					.patch("packageAdjustments", adjustment._id, { invoiceEmailClaimedAt: args.now })
					.then(() =>
						ctx.scheduler.runAfter(
							PACKAGE_ADJUSTMENT_EMAIL_CLAIM_TIMEOUT_MS,
							internal.packageAdjustments.markStalledPackageAdjustmentInvoiceEmailFailed,
							{ adjustmentId: args.adjustmentId, claimedAt: args.now }
						)
					)
					.then(() => ({ adjustment, packageRecord }))
			)
		);
}

export function markStalledPackageAdjustmentInvoiceEmailFailed(
	ctx: MutationCtx,
	args: ClaimedPackageAdjustmentInvoiceEmailArgs
) {
	return getPackageAdjustmentInvoice(ctx, args.adjustmentId)
		.orElse(() => ok(null))
		.andThen((adjustment) => {
			if (
				!adjustment ||
				adjustment.invoiceEmailStatus !== "pending" ||
				adjustment.invoiceEmailClaimedAt !== args.claimedAt
			) {
				return ok(null);
			}

			return okOrThrow(
				ctx.db
					.patch("packageAdjustments", adjustment._id, {
						invoiceEmailStatus: "failed",
						invoiceEmailClaimedAt: undefined
					})
					.then(() => null)
			);
		});
}

export function writePackageAdjustmentInvoiceEmailSent(
	ctx: MutationCtx,
	args: ClaimedPackageAdjustmentInvoiceEmailArgs & { stripeInvoiceId: string }
) {
	return getPackageAdjustmentInvoice(ctx, args.adjustmentId).andThen((adjustment) => {
		if (adjustment.invoiceEmailClaimedAt !== args.claimedAt) {
			return ok({ updated: false });
		}

		return okOrThrow(
			ctx.db
				.patch("packageAdjustments", adjustment._id, {
					invoiceEmailStatus: "sent",
					invoiceEmailClaimedAt: undefined,
					stripeInvoiceId: args.stripeInvoiceId
				})
				.then(() => ({ updated: true }))
		).andThen((result) => {
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
			}).map(() => result);
		});
	});
}

export function writePackageAdjustmentInvoiceEmailFailed(
	ctx: MutationCtx,
	args: ClaimedPackageAdjustmentInvoiceEmailArgs
) {
	return getPackageAdjustmentInvoice(ctx, args.adjustmentId).andThen((adjustment) => {
		if (adjustment.invoiceEmailClaimedAt !== args.claimedAt) {
			return ok({ updated: false });
		}

		return okOrThrow(
			ctx.db
				.patch("packageAdjustments", adjustment._id, {
					invoiceEmailStatus: "failed",
					invoiceEmailClaimedAt: undefined
				})
				.then(() => ({ updated: true }))
		);
	});
}

export function claimPackageAdjustmentInvoicePaymentAndArchive(
	ctx: MutationCtx,
	args: { stripeInvoiceId: string; adjustmentId?: string; paidAt: number }
) {
	return claimPackageAdjustmentInvoicePayment(ctx, args).andThen((claim) => {
		if (claim.outcome !== "completed") {
			return okAsync(claim);
		}

		return archivePackageWhenFullyDone(ctx, claim.packageId, args.paidAt).map(() => claim);
	});
}

export function updatePackageAdjustmentPaymentStatusFromAdmin(
	ctx: MutationCtx,
	args: MarkPackageAdjustmentPaymentStatusArgs
) {
	return requirePermission(ctx, "update:payment-status")
		.andThen(() => getPackageAdjustmentInvoice(ctx, args.adjustmentId))
		.andThen((adjustment) => requirePackageAdjustmentPaymentEligibility(adjustment, Date.now()))
		.andThen((adjustment) =>
			okOrThrow(
				ctx.db
					.patch("packageAdjustments", adjustment._id, {
						paymentStatus: args.paid ? "paid" : "unpaid"
					})
					.then(() => adjustment)
			).andThen((updatedAdjustment) => {
				if (!args.paid) {
					return okAsync(null);
				}

				return archivePackageWhenFullyDone(ctx, updatedAdjustment.packageId);
			})
		);
}
