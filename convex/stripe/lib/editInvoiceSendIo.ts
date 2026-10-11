"use node";

import { internal } from "#convex/_generated/api";

import type { ActionCtx } from "#convex/_generated/server";
import { fromConvexTuple } from "#convex/shared/lib/result";

export function backfillCheckoutPaymentsOperation(
	ctx: ActionCtx,
	args: { table: "bookings" | "packages"; cursor: string | null }
) {
	return fromConvexTuple(ctx.runQuery(internal.stripe.editInvoices.getMissingPayments, args));
}
