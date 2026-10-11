import { type ResultAsync } from "neverthrow";
import type { ActionCtx } from "#convex/_generated/server";
import type { PackageAdjustmentInvoicePaymentClaimError } from "#convex/packages/lib/adjustmentInvoicePayment";
import { fromConvexTuple } from "#convex/shared/lib/result";
import {
	claimPackageAdjustmentPaymentForAction,
	markStripeInvoicePaidForAction,
	resolveMissingAdjustmentAfterStripePaid
} from "#convex/stripe/lib/invoicePayment";

type CompleteStripeInvoicePaymentSuccess = { outcome: "already_completed" | "completed" };

type CompleteStripeInvoicePaymentFailure =
	| { kind: "claim_failed"; error: PackageAdjustmentInvoicePaymentClaimError }
	| { kind: "not_found" };

function completeAdjustmentInvoiceAfterStripePaid(
	ctx: ActionCtx,
	args: { stripeInvoiceId: string; adjustmentId?: string; paidAt: number },

	stripeInvoiceClaim: { outcome: "completed" | "already_completed" | "not_found" }
) {
	return fromConvexTuple(claimPackageAdjustmentPaymentForAction(ctx, args))
		.map((claim) => ({ outcome: claim.outcome }))
		.orElse((adjustmentError: PackageAdjustmentInvoicePaymentClaimError) =>
			resolveMissingAdjustmentAfterStripePaid(stripeInvoiceClaim, adjustmentError)
		);
}

export function completeStripeInvoicePaymentService(
	ctx: ActionCtx,
	args: { stripeInvoiceId: string; adjustmentId?: string; paidAt: number }
): ResultAsync<CompleteStripeInvoicePaymentSuccess, CompleteStripeInvoicePaymentFailure> {
	return fromConvexTuple(markStripeInvoicePaidForAction(ctx, args)).andThen(
		(stripeInvoiceClaim: { outcome: "completed" | "already_completed" | "not_found" }) =>
			completeAdjustmentInvoiceAfterStripePaid(ctx, args, stripeInvoiceClaim)
	);
}
