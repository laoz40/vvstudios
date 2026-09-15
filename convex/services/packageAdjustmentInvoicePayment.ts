import { okAsync, type ResultAsync } from "neverthrow";
import { internal } from "#convex/_generated/api";
import type { ActionCtx } from "#convex/_generated/server";
import type { PackageAdjustmentInvoicePaymentClaimError } from "#convex/lib/packageAdjustmentInvoicePayment";
import { fromConvexTuple } from "#convex/lib/result";

type CompletePackageAdjustmentInvoicePaymentSuccess = {
	outcome: "already_completed" | "completed";
};

type CompletePackageAdjustmentInvoicePaymentFailure =
	| { kind: "claim_failed"; error: PackageAdjustmentInvoicePaymentClaimError }
	| {
			kind: "completion_failed";
			error:
				| { reason: "INVALID_BOOKING_DATA" }
				| { reason: "RECEIPT_EMAIL_RENDER_FAILED" }
				| { reason: "RECEIPT_SEND_FAILED" };
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
		.andThen((claim) => {
			if (claim.outcome === "already_completed") {
				return okAsync({ outcome: "already_completed" as const });
			}

			return fromConvexTuple(
				ctx.runAction(
					internal.packageAdjustmentInvoicePaymentHandlers.sendPackageAdjustmentReceiptAfterPayment,
					{ adjustmentId: claim.adjustmentId, paidAt: args.paidAt }
				)
			).mapErr((error) => ({ kind: "completion_failed" as const, error }));
		});
}
