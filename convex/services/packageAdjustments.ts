import type { Id } from "#convex/_generated/dataModel";
import type { MutationCtx } from "#convex/_generated/server";
import { getAdminIdentityResult } from "#convex/lib/auth";
import { getSentPackageAdjustmentInvoiceResult } from "#convex/lib/packageAdjustments";
import { okOrThrow } from "#convex/lib/result";

type MarkPackageAdjustmentPaymentStatusArgs = {
	adjustmentId: Id<"packageAdjustments">;
	paid: boolean;
};

export function markPackageAdjustmentPaymentStatusService(
	ctx: MutationCtx,
	args: MarkPackageAdjustmentPaymentStatusArgs
) {
	return getAdminIdentityResult(ctx)
		.andThen(() => getSentPackageAdjustmentInvoiceResult(ctx, args.adjustmentId))
		.andThen((adjustment) =>
			okOrThrow(
				ctx.db
					.patch(adjustment._id, { paymentStatus: args.paid ? "paid" : "unpaid" })
					.then(() => null)
			)
		);
}
