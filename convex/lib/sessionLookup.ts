import { err, ok, type Result } from "../../src/lib/result";
import { internal } from "../_generated/api";
import type { Doc, Id } from "../_generated/dataModel";
import type { ActionCtx, MutationCtx } from "../_generated/server";

export async function getSessionFromDb(
	ctx: MutationCtx,
	bookingId: Id<"bookings">
): Promise<Result<Doc<"bookings">, { reason: "BOOKING_NOT_FOUND" }>> {
	const session = await ctx.db.get(bookingId);

	if (!session) {
		return err({ reason: "BOOKING_NOT_FOUND" });
	}

	return ok(session);
}

export async function getSessionFromQuery(
	ctx: ActionCtx,
	bookingId: Id<"bookings">
): Promise<Result<Doc<"bookings">, { reason: "BOOKING_NOT_FOUND" }>> {
	const session: Doc<"bookings"> | null = await ctx.runQuery(
		internal.sessions.getSessionByIdInternal,
		{ bookingId }
	);

	if (!session) {
		return err({ reason: "BOOKING_NOT_FOUND" });
	}

	return ok(session);
}
