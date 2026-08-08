import { ok } from "neverthrow";
import type { Id } from "#convex/_generated/dataModel";
import type { MutationCtx, QueryCtx } from "#convex/_generated/server";
import { requirePermission } from "#convex/lib/auth";
import {
	getPackageAdjustmentInvoice,
	getSentPackageAdjustmentInvoice,
	validatePackageAdjustmentEmailClaim,
	type PackageAdjustmentEmailClaim
} from "#convex/lib/packageAdjustments";
import { getPackageFromDb } from "#convex/lib/packageLookup";
import { okOrThrow } from "#convex/lib/result";

export type ClaimPackageAdjustmentInvoiceEmailArgs = PackageAdjustmentEmailClaim & {
	adjustmentId: Id<"packageAdjustments">;
};

type ClaimedPackageAdjustmentInvoiceEmailArgs = {
	adjustmentId: Id<"packageAdjustments">;
	claimedAt: number;
};

type MarkPackageAdjustmentPaymentStatusArgs = {
	adjustmentId: Id<"packageAdjustments">;
	paid: boolean;
};

export function getPackageAdjustmentInvoiceInputService(
	ctx: QueryCtx,
	args: { adjustmentId: Id<"packageAdjustments"> }
) {
	return getSentPackageAdjustmentInvoice(ctx, args.adjustmentId).andThen((adjustment) =>
		getPackageFromDb(ctx, adjustment.multiBookingId)
			.map((multiBooking) => ({ adjustment, multiBooking }))
			.mapErr(() => ({ reason: "PACKAGE_ADJUSTMENT_NOT_FOUND" as const }))
	);
}

export function claimPackageAdjustmentInvoiceEmailService(
	ctx: MutationCtx,
	args: ClaimPackageAdjustmentInvoiceEmailArgs,
	scheduleStalledEmailRecovery: () => Promise<unknown>
) {
	return (
		getPackageAdjustmentInvoice(ctx, args.adjustmentId)
			// Confirm this attempt can claim the email without replacing an active sender.
			.andThen((adjustment) => validatePackageAdjustmentEmailClaim(adjustment, args))
			// Load the package snapshot needed to render and send the adjustment invoice.
			.andThen((adjustment) =>
				getPackageFromDb(ctx, adjustment.multiBookingId).map((multiBooking) => ({
					adjustment,
					multiBooking
				}))
			)
			// Claim the email and schedule recovery if the sender never records a result.
			.andThen(({ adjustment, multiBooking }) =>
				okOrThrow(
					ctx.db
						.patch(adjustment._id, { invoiceEmailClaimedAt: args.now })
						// If the sender never records sent or failed, this delayed job releases its claim.
						.then(scheduleStalledEmailRecovery)
						.then(() => ({ adjustment, multiBooking }))
				)
			)
	);
}

// Starting an email records a claim so another sender cannot send it at the same time.
// If that sender never finishes, this delayed cleanup marks the email failed and clears the claim
// so it can be retried.
export function markStalledPackageAdjustmentInvoiceEmailFailedService(
	ctx: MutationCtx,
	args: ClaimedPackageAdjustmentInvoiceEmailArgs
) {
	return (
		getPackageAdjustmentInvoice(ctx, args.adjustmentId)
			// A missing adjustment needs no cleanup, so treat not found as success. Database failures still reject.
			.orElse(() => ok(null))
			.andThen((adjustment) => {
				// Ignore missing adjustments, completed emails, and recovery jobs for superseded claims.
				if (
					!adjustment ||
					adjustment.invoiceEmailStatus !== "pending" ||
					adjustment.invoiceEmailClaimedAt !== args.claimedAt
				) {
					return ok(null);
				}

				return okOrThrow(
					ctx.db
						.patch(adjustment._id, {
							invoiceEmailStatus: "failed",
							invoiceEmailClaimedAt: undefined
						})
						.then(() => null)
				);
			})
	);
}

export function completePackageAdjustmentInvoiceEmailService(
	ctx: MutationCtx,
	args: ClaimedPackageAdjustmentInvoiceEmailArgs,
	status: "sent" | "failed"
) {
	return getPackageAdjustmentInvoice(ctx, args.adjustmentId).andThen((adjustment) => {
		// Ignore completion from a timed-out attempt after a newer retry claimed the email.
		if (adjustment.invoiceEmailClaimedAt !== args.claimedAt) {
			return ok({ updated: false });
		}

		return okOrThrow(
			ctx.db
				.patch(adjustment._id, { invoiceEmailStatus: status, invoiceEmailClaimedAt: undefined })
				.then(() => ({ updated: true }))
		);
	});
}

export function markPackageAdjustmentPaymentStatusService(
	ctx: MutationCtx,
	args: MarkPackageAdjustmentPaymentStatusArgs
) {
	return requirePermission(ctx, "update:payment-status")
		.andThen(() => getSentPackageAdjustmentInvoice(ctx, args.adjustmentId))
		.andThen((adjustment) =>
			okOrThrow(
				ctx.db
					.patch(adjustment._id, { paymentStatus: args.paid ? "paid" : "unpaid" })
					.then(() => null)
			)
		);
}
