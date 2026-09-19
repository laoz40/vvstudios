import { type ResultAsync } from "neverthrow";
import { internal } from "#convex/_generated/api";
import type { ActionCtx } from "#convex/_generated/server";
import type { PackageAdjustmentInvoicePaymentClaimError } from "#convex/lib/packageAdjustmentInvoicePayment";
import { fromConvexTuple } from "#convex/lib/result";

type CompletePackageAdjustmentInvoicePaymentSuccess = {
	outcome: "already_completed" | "completed";
};

type CompletePackageAdjustmentInvoicePaymentFailure = {
	kind: "claim_failed";
	error: PackageAdjustmentInvoicePaymentClaimError;
};

export function completePackageAdjustmentInvoicePaymentService(
	ctx: ActionCtx,
	args: { stripeInvoiceId: string; adjustmentId?: string; paidAt: number }
): ResultAsync<
	CompletePackageAdjustmentInvoicePaymentSuccess,
	CompletePackageAdjustmentInvoicePaymentFailure
> {
	return fromConvexTuple(
		ctx.runMutation(internal.packageAdjustments.claimPackageAdjustmentInvoicePayment, args)
	)
		.mapErr((error) => ({ kind: "claim_failed" as const, error }))
		.map((claim) => {
			if (claim.outcome === "already_completed") {
				return { outcome: "already_completed" as const };
			}

			return { outcome: "completed" as const };
		});
}
