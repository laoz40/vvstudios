import { err, ok } from "neverthrow";
import type { Id } from "#convex/_generated/dataModel";
import type { MutationCtx, QueryCtx } from "#convex/_generated/server";
import { okOrThrow } from "#convex/lib/result";

export function getBookingRow(ctx: QueryCtx | MutationCtx, bookingId: Id<"bookings">) {
	return okOrThrow(ctx.db.get("bookings", bookingId));
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
