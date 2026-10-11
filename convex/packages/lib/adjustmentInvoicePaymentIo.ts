import { internal } from "#convex/_generated/api";
import type { ActionCtx } from "#convex/_generated/server";

import { fromConvexTuple } from "#convex/shared/lib/result";

export function completePackageAdjustmentInvoicePaymentServiceOperation(
	ctx: ActionCtx,
	args: { stripeInvoiceId: string; adjustmentId?: string; paidAt: number }
) {
	return fromConvexTuple(
		ctx.runMutation(internal.packages.adjustments.claimPackageAdjustmentInvoicePayment, args)
	);
}
