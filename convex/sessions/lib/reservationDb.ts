import type { Id } from "#convex/_generated/dataModel";
import type { MutationCtx } from "#convex/_generated/server";
import { okOrThrow } from "#convex/shared/lib/result";
import { clearedSessionReservationPatch } from "#convex/sessions/lib/reservations";

export function writeBookingReservationFields(
	ctx: MutationCtx,
	bookingId: Id<"bookings">,
	fields: {
		reservationCreatedAt: number;
		reservationSessionStartAt: number;
		reservationDuration: string;
	}
) {
	return okOrThrow(ctx.db.patch("bookings", bookingId, fields).then(() => null));
}

export function clearBookingReservationFields(ctx: MutationCtx, bookingId: Id<"bookings">) {
	return okOrThrow(
		ctx.db.patch("bookings", bookingId, clearedSessionReservationPatch).then(() => null)
	);
}

export function collectConfirmedBookingsInWindow(
	ctx: MutationCtx,
	args: { searchStartAt: number; searchEndAt: number }
) {
	return okOrThrow(
		Promise.all([
			ctx.db
				.query("bookings")
				.withIndex("by_status_and_sessionStartAt", (query) =>
					query
						.eq("status", "confirmed")
						.gte("sessionStartAt", args.searchStartAt)
						.lte("sessionStartAt", args.searchEndAt)
				)
				.collect(),
			ctx.db
				.query("bookings")
				.withIndex("by_status_and_sessionStartAt", (query) =>
					query
						.eq("status", "email_failed")
						.gte("sessionStartAt", args.searchStartAt)
						.lte("sessionStartAt", args.searchEndAt)
				)
				.collect()
		])
	).map((rows) => rows.flat());
}

export function collectActiveReservationBookings(
	ctx: MutationCtx,
	reservationCreatedAfter: number
) {
	return okOrThrow(
		ctx.db
			.query("bookings")
			.withIndex("by_reservationCreatedAt", (query) =>
				query.gt("reservationCreatedAt", reservationCreatedAfter)
			)
			.collect()
	);
}
