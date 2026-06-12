import { err, ok, type Result } from "../../src/lib/result";
import { internal } from "../_generated/api";
import type { Doc, Id } from "../_generated/dataModel";
import type { ActionCtx, MutationCtx } from "../_generated/server";

export async function getBookingFromDb(
	ctx: MutationCtx,
	bookingId: Id<"bookings">
): Promise<Result<Doc<"bookings">, { reason: "BOOKING_NOT_FOUND" }>> {
	const booking = await ctx.db.get(bookingId);

	if (!booking) {
		return err({ reason: "BOOKING_NOT_FOUND" });
	}

	return ok(booking);
}

export async function getBookingFromQuery(
	ctx: ActionCtx,
	bookingId: Id<"bookings">
): Promise<Result<Doc<"bookings">, { reason: "BOOKING_NOT_FOUND" }>> {
	const booking: Doc<"bookings"> | null = await ctx.runQuery(
		internal.bookings.getBookingByIdInternal,
		{ bookingId }
	);

	if (!booking) {
		return err({ reason: "BOOKING_NOT_FOUND" });
	}

	return ok(booking);
}
