import { completePackageAdjustmentInvoicePaymentServiceOperation } from "#convex/packages/lib/adjustmentInvoicePaymentIo";
import { ok, safeTry } from "neverthrow";

import type { ActionCtx } from "#convex/_generated/server";

export function completePackageAdjustmentInvoicePaymentService(
	ctx: ActionCtx,
	args: { stripeInvoiceId: string; adjustmentId?: string; paidAt: number }
) {
	return safeTry(async function* () {
		const paymentResult = yield* completePackageAdjustmentInvoicePaymentServiceOperation(
			ctx,
			args
		).mapErr((error) => ({ kind: "claim_failed" as const, error }));

		return ok({ outcome: paymentResult.outcome });
	});
}
