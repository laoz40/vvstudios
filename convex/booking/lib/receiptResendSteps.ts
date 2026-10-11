"use node";

import { internal } from "#convex/_generated/api";
import type { Doc } from "#convex/_generated/dataModel";
import type { ActionCtx } from "#convex/_generated/server";

import { fromConvexTuple } from "#convex/shared/lib/result";

export function markReceiptResendSent(ctx: ActionCtx, session: Doc<"bookings">) {
	return fromConvexTuple(
		ctx.runMutation(internal.booking.confirmation.markSessionInvoiceEmailRetrySent, {
			bookingId: session._id
		})
	);
}

export function recordReceiptNumberMutation(
	ctx: ActionCtx,
	session: Doc<"bookings">,
	receiptNumber: string
) {
	return fromConvexTuple(
		ctx.runMutation(internal.booking.confirmation.recordBookingReceiptNumber, {
			bookingId: session._id,
			receiptNumber
		})
	);
}

export function ensureReceiptNumberMutation(ctx: ActionCtx, session: Doc<"bookings">) {
	return fromConvexTuple(
		ctx.runMutation(internal.booking.confirmation.ensureStandaloneBookingReceiptNumber, {
			bookingId: session._id
		})
	);
}
