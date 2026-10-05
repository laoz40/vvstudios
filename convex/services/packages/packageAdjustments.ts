import { err } from "neverthrow";
import type { Id } from "#convex/_generated/dataModel";
import type { MutationCtx, QueryCtx } from "#convex/_generated/server";
import {
	lookupPackageAdjustmentRow,
	requirePackageAdjustmentInvoiceRow
} from "#convex/lib/packages/packageAdjustments";

export function getPackageAdjustmentInvoice(
	ctx: QueryCtx | MutationCtx,
	adjustmentId: Id<"packageAdjustments">
) {
	return lookupPackageAdjustmentRow(ctx, adjustmentId).andThen((adjustment) => {
		if (!adjustment) {
			return err({ reason: "PACKAGE_ADJUSTMENT_NOT_FOUND" as const });
		}

		return requirePackageAdjustmentInvoiceRow(adjustment);
	});
}
