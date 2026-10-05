import { err, ok, type ResultAsync } from "neverthrow";
import { internal } from "#convex/_generated/api";
import type { ActionCtx } from "#convex/_generated/server";
import type { PackageAdjustmentInvoicePaymentClaimError } from "#convex/lib/packages/packageAdjustmentInvoicePayment";
import { fromConvexTuple } from "#convex/lib/result";

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
	args: { stripeInvoiceId: string; adjustmentId?: string; paidAt: number }
) {
	return (stripeInvoiceClaim: { outcome: "completed" | "already_completed" | "not_found" }) =>
		fromConvexTuple(
			ctx.runMutation(internal.packageAdjustments.claimPackageAdjustmentInvoicePayment, args)
		)
			.map(toStripeInvoicePaymentCompletionOutcome)
			.orElse(resolveMissingAdjustmentAfterStripePaid(stripeInvoiceClaim));
}

function resolveMissingAdjustmentAfterStripePaid(stripeInvoiceClaim: {
	outcome: "completed" | "already_completed" | "not_found";
}) {
	return (adjustmentError: PackageAdjustmentInvoicePaymentClaimError) => {
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
	};
}

export function completeStripeInvoicePaymentService(
	ctx: ActionCtx,
	args: { stripeInvoiceId: string; adjustmentId?: string; paidAt: number }
): ResultAsync<CompleteStripeInvoicePaymentSuccess, CompleteStripeInvoicePaymentFailure> {
	return fromConvexTuple(
		ctx.runMutation(internal.stripeInvoices.markStripeInvoicePaid, {
			stripeInvoiceId: args.stripeInvoiceId,
			paidAt: args.paidAt
		})
	).andThen(completeAdjustmentInvoiceAfterStripePaid(ctx, args));
}
