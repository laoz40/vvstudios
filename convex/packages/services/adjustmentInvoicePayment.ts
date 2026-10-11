import { completePackageAdjustmentInvoicePaymentServiceOperation } from "#convex/packages/lib/adjustmentInvoicePaymentIo";
import { type ResultAsync } from "neverthrow";

import type { ActionCtx } from "#convex/_generated/server";
import { type PackageAdjustmentInvoicePaymentClaimError } from "#convex/packages/lib/adjustmentInvoicePayment";

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
	return completePackageAdjustmentInvoicePaymentServiceOperation(ctx, args)
		.mapErr((error) => ({ kind: "claim_failed" as const, error }))
		.map(({ outcome }) => ({ outcome }));
}
