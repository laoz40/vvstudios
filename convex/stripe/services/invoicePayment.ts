import { ok, safeTry } from "neverthrow";
import type { ActionCtx } from "#convex/_generated/server";
import type { PackageAdjustmentInvoicePaymentClaimError } from "#convex/packages/lib/adjustmentInvoicePayment";
import { fromConvexTuple } from "#convex/shared/lib/result";
import {
	claimPackageAdjustmentPaymentForAction,
	markStripeInvoicePaidForAction,
	resolveMissingAdjustmentAfterStripePaid
} from "#convex/stripe/lib/invoicePayment";

function completeAdjustmentInvoiceAfterStripePaid(
	ctx: ActionCtx,
	args: { stripeInvoiceId: string; adjustmentId?: string; paidAt: number },

	stripeInvoiceClaim: { outcome: "completed" | "already_completed" | "not_found" }
) {
	return safeTry(async function* () {
		const adjustmentClaim = yield* fromConvexTuple(
			claimPackageAdjustmentPaymentForAction(ctx, args)
		);

		return ok({ outcome: adjustmentClaim.outcome });
	}).orElse((adjustmentError: PackageAdjustmentInvoicePaymentClaimError) =>
		resolveMissingAdjustmentAfterStripePaid(stripeInvoiceClaim, adjustmentError)
	);
}

export function completeStripeInvoicePaymentService(
	ctx: ActionCtx,
	args: { stripeInvoiceId: string; adjustmentId?: string; paidAt: number }
) {
	return safeTry(async function* () {
		const stripeInvoiceClaim = yield* fromConvexTuple(markStripeInvoicePaidForAction(ctx, args));

		const paymentResult = yield* completeAdjustmentInvoiceAfterStripePaid(
			ctx,
			args,
			stripeInvoiceClaim
		);

		return ok(paymentResult);
	});
}
