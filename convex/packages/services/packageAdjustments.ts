import { err } from "neverthrow";
import type { Id } from "#convex/_generated/dataModel";
import type { MutationCtx, QueryCtx } from "#convex/_generated/server";
import {
	lookupPackageAdjustmentRow,
	requirePackageAdjustmentInvoiceRow
} from "#convex/packages/lib/packageAdjustments";
import type { Doc } from "#convex/_generated/dataModel";

function requirePackageAdjustmentInvoiceFromLookup(adjustment: Doc<"packageAdjustments"> | null) {
	if (!adjustment) {
		return err({ reason: "PACKAGE_ADJUSTMENT_NOT_FOUND" as const });
	}

	return requirePackageAdjustmentInvoiceRow(adjustment);
}

export function getPackageAdjustmentInvoice(
	ctx: QueryCtx | MutationCtx,
	adjustmentId: Id<"packageAdjustments">
) {
	return lookupPackageAdjustmentRow(ctx, adjustmentId).andThen(
		requirePackageAdjustmentInvoiceFromLookup
	);
}
