import { err, ok, type Result } from "neverthrow";
import { internal } from "#convex/_generated/api";
import type { Doc, Id } from "#convex/_generated/dataModel";
import type { ActionCtx, MutationCtx, QueryCtx } from "#convex/_generated/server";
import { fromConvexTuple, okOrThrow } from "#convex/shared/lib/result";

export function requireBookingRow(
	session: Doc<"bookings"> | null
): Result<Doc<"bookings">, { reason: "BOOKING_NOT_FOUND" }> {
	if (session === null) {
		return err({ reason: "BOOKING_NOT_FOUND" });
	}

	return ok(session);
}

export function getBookingRow(ctx: QueryCtx | MutationCtx, bookingId: Id<"bookings">) {
	return okOrThrow(ctx.db.get("bookings", bookingId));
}

export function getBookingRowForAction(ctx: ActionCtx, bookingId: Id<"bookings">) {
	return fromConvexTuple(ctx.runQuery(internal.sessions.admin.getSessionById, { bookingId }));
}

export function normalizeBookingId(ctx: QueryCtx | MutationCtx, bookingId: string) {
	const normalizedBookingId = ctx.db.normalizeId("bookings", bookingId);

	return normalizedBookingId
		? ok(normalizedBookingId)
		: err({ reason: "BOOKING_NOT_FOUND" as const });
}

export function lookupBookingByStripeSessionId(
	ctx: QueryCtx | MutationCtx,
	stripeSessionId: string
) {
	return okOrThrow(
		ctx.db
			.query("bookings")
			.withIndex("by_stripeSessionId", (indexQuery) =>
				indexQuery.eq("stripeSessionId", stripeSessionId)
			)
			.unique()
	);
}
