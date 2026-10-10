import { err, ok, type ResultAsync } from "neverthrow";
import { internal } from "#convex/_generated/api";
import type { ActionCtx } from "#convex/_generated/server";
import type { PackageAdjustmentInvoicePaymentClaimError } from "#convex/packages/lib/adjustmentInvoicePayment";
import { fromConvexTuple } from "#convex/shared/lib/result";

type CompleteStripeInvoicePaymentSuccess = { outcome: "already_completed" | "completed" };

type CompleteStripeInvoicePaymentFailure =
	| { kind: "claim_failed"; error: PackageAdjustmentInvoicePaymentClaimError }
	| { kind: "not_found" };

function toStripeInvoicePaymentCompletionOutcome(claim: {
	outcome: "already_completed" | "completed";
}) {
	if (claim.outcome === "already_completed") {
		return { outcome: "already_completed" as const };
	}

	return { outcome: "completed" as const };
}

function completeAdjustmentInvoiceAfterStripePaid(
	ctx: ActionCtx,
	args: { stripeInvoiceId: string; adjustmentId?: string; paidAt: number },

	stripeInvoiceClaim: { outcome: "completed" | "already_completed" | "not_found" }
) {
	return fromConvexTuple(
		ctx.runMutation(internal.packages.adjustments.claimPackageAdjustmentInvoicePayment, args)
	)
		.map(toStripeInvoicePaymentCompletionOutcome)
		.orElse((adjustmentError: PackageAdjustmentInvoicePaymentClaimError) =>
			resolveMissingAdjustmentAfterStripePaid(stripeInvoiceClaim, adjustmentError)
		);
}

function resolveMissingAdjustmentAfterStripePaid(
	stripeInvoiceClaim: { outcome: "completed" | "already_completed" | "not_found" },
	adjustmentError: PackageAdjustmentInvoicePaymentClaimError
) {
	if (adjustmentError.reason === "PACKAGE_ADJUSTMENT_NOT_FOUND") {
		if (
			stripeInvoiceClaim.outcome === "completed" ||
			stripeInvoiceClaim.outcome === "already_completed"
		) {
			return ok({ outcome: "completed" as const });
		}

		return err({ kind: "not_found" as const });
	}

	return err({ kind: "claim_failed" as const, error: adjustmentError });
}

export function completeStripeInvoicePaymentService(
	ctx: ActionCtx,
	args: { stripeInvoiceId: string; adjustmentId?: string; paidAt: number }
): ResultAsync<CompleteStripeInvoicePaymentSuccess, CompleteStripeInvoicePaymentFailure> {
	return fromConvexTuple(
		ctx.runMutation(internal.stripe.invoiceRecords.markStripeInvoicePaid, {
			stripeInvoiceId: args.stripeInvoiceId,
			paidAt: args.paidAt
		})
	).andThen((stripeInvoiceClaim: { outcome: "completed" | "already_completed" | "not_found" }) =>
		completeAdjustmentInvoiceAfterStripePaid(ctx, args, stripeInvoiceClaim)
	);
}
