import { err, ok } from "neverthrow";
import type { Result } from "neverthrow";
import { internal } from "#convex/_generated/api";
import type { ActionCtx } from "#convex/_generated/server";
import type { PackageAdjustmentInvoicePaymentClaimError } from "#convex/packages/lib/adjustmentInvoicePayment";

export type StripeInvoicePaymentClaim = {
	outcome: "completed" | "already_completed" | "not_found";
};

export function markStripeInvoicePaidForAction(
	ctx: ActionCtx,
	args: { stripeInvoiceId: string; paidAt: number }
) {
	return ctx.runMutation(internal.stripe.invoiceRecords.markStripeInvoicePaid, {
		stripeInvoiceId: args.stripeInvoiceId,
		paidAt: args.paidAt
	});
}

export function claimPackageAdjustmentPaymentForAction(
	ctx: ActionCtx,
	args: { stripeInvoiceId: string; adjustmentId?: string; paidAt: number }
) {
	return ctx.runMutation(internal.packages.adjustments.claimPackageAdjustmentInvoicePayment, args);
}

export function resolveMissingAdjustmentAfterStripePaid(
	stripeInvoiceClaim: StripeInvoicePaymentClaim,
	adjustmentError: PackageAdjustmentInvoicePaymentClaimError
): Result<
	{ outcome: "completed" },
	{ kind: "not_found" } | { kind: "claim_failed"; error: PackageAdjustmentInvoicePaymentClaimError }
> {
	if (adjustmentError.reason === "PACKAGE_ADJUSTMENT_NOT_FOUND") {
		return stripeInvoiceClaim.outcome === "completed" ||
			stripeInvoiceClaim.outcome === "already_completed"
			? ok({ outcome: "completed" as const })
			: err({ kind: "not_found" as const });
	}

	return err({ kind: "claim_failed" as const, error: adjustmentError });
}
