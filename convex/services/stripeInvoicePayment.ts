import { err, ok, type ResultAsync } from "neverthrow";
import { internal } from "#convex/_generated/api";
import type { ActionCtx } from "#convex/_generated/server";
import type { PackageAdjustmentInvoicePaymentClaimError } from "#convex/lib/packageAdjustmentInvoicePayment";
import { fromConvexTuple } from "#convex/lib/result";

type CompleteStripeInvoicePaymentSuccess = { outcome: "already_completed" | "completed" };

type CompleteStripeInvoicePaymentFailure =
	| { kind: "claim_failed"; error: PackageAdjustmentInvoicePaymentClaimError }
	| { kind: "not_found" };

export function completeStripeInvoicePaymentService(
	ctx: ActionCtx,
	args: { stripeInvoiceId: string; adjustmentId?: string; paidAt: number }
): ResultAsync<CompleteStripeInvoicePaymentSuccess, CompleteStripeInvoicePaymentFailure> {
	return fromConvexTuple(
		ctx.runMutation(internal.stripeInvoices.markStripeInvoicePaid, {
			stripeInvoiceId: args.stripeInvoiceId,
			paidAt: args.paidAt
		})
	).andThen((stripeInvoiceClaim) =>
		fromConvexTuple(
			ctx.runMutation(internal.packageAdjustments.claimPackageAdjustmentInvoicePayment, args)
		)
			.map((adjustmentClaim) => {
				if (adjustmentClaim.outcome === "already_completed") {
					return { outcome: "already_completed" as const };
				}

				return { outcome: "completed" as const };
			})
			.orElse((adjustmentError) => {
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
			})
	);
}
