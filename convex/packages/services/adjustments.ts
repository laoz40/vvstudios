import { ok, safeTry } from "neverthrow";
import type { Id } from "#convex/_generated/dataModel";
import type { MutationCtx, QueryCtx } from "#convex/_generated/server";
import {
	lookupPackageAdjustmentRow,
	requirePackageAdjustmentInvoiceRowFromLookup
} from "#convex/packages/lib/adjustments";

export function getPackageAdjustmentInvoice(
	ctx: QueryCtx | MutationCtx,
	adjustmentId: Id<"packageAdjustments">
) {
	return safeTry(async function* () {
		const adjustmentLookup = yield* lookupPackageAdjustmentRow(ctx, adjustmentId);
		const adjustment = yield* requirePackageAdjustmentInvoiceRowFromLookup(adjustmentLookup);

		return ok(adjustment);
	});
}
