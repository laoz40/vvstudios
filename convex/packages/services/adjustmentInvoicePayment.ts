import { type ResultAsync } from "neverthrow";
import { internal } from "#convex/_generated/api";
import type { ActionCtx } from "#convex/_generated/server";
import type { PackageAdjustmentInvoicePaymentClaimError } from "#convex/packages/lib/adjustmentInvoicePayment";
import { fromConvexTuple } from "#convex/shared/lib/result";

type CompletePackageAdjustmentInvoicePaymentSuccess = {
	outcome: "already_completed" | "completed";
};

type CompletePackageAdjustmentInvoicePaymentFailure = {
	kind: "claim_failed";
	error: PackageAdjustmentInvoicePaymentClaimError;
};

function mapPackageAdjustmentInvoicePaymentClaimFailed(
	error: PackageAdjustmentInvoicePaymentClaimError
) {
	return { kind: "claim_failed" as const, error };
}

function toPackageAdjustmentInvoicePaymentCompletionOutcome(claim: {
	outcome: "already_completed" | "completed";
}) {
	if (claim.outcome === "already_completed") {
		return { outcome: "already_completed" as const };
	}

	return { outcome: "completed" as const };
}

export function completePackageAdjustmentInvoicePaymentService(
	ctx: ActionCtx,
	args: { stripeInvoiceId: string; adjustmentId?: string; paidAt: number }
): ResultAsync<
	CompletePackageAdjustmentInvoicePaymentSuccess,
	CompletePackageAdjustmentInvoicePaymentFailure
> {
	return fromConvexTuple(
		ctx.runMutation(internal.packages.adjustments.claimPackageAdjustmentInvoicePayment, args)
	)
		.mapErr(mapPackageAdjustmentInvoicePaymentClaimFailed)
		.map(toPackageAdjustmentInvoicePaymentCompletionOutcome);
}
