import { err, ok, ResultAsync } from "neverthrow";
import type { Id } from "#convex/_generated/dataModel";
import type { MutationCtx } from "#convex/_generated/server";
import { getAdminIdentityResult } from "#convex/lib/auth";
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
		.andThen(() => ResultAsync.fromSafePromise(ctx.db.get(args.adjustmentId)))
		.andThen((adjustment) => {
			if (!adjustment || adjustment.outcome !== "invoice_required") {
				return err({ reason: "PACKAGE_ADJUSTMENT_NOT_FOUND" as const });
			}
			if (adjustment.invoiceEmailStatus !== "sent") {
				return err({ reason: "PACKAGE_ADJUSTMENT_INVOICE_NOT_SENT" as const });
			}
			return ok(adjustment);
		})
		.andThen((adjustment) =>
			okOrThrow(
				ctx.db
					.patch(adjustment._id, { paymentStatus: args.paid ? "paid" : "unpaid" })
					.then(() => null)
			)
		);
}
