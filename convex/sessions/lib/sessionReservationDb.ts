import type { Doc, Id } from "#convex/_generated/dataModel";
import type { MutationCtx } from "#convex/_generated/server";
import { okOrThrow } from "#convex/shared/lib/result";
import { clearedSessionReservationPatch } from "#convex/sessions/lib/sessionReservations";

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

export async function collectConfirmedBookingsInWindow(
	ctx: MutationCtx,
	args: { searchStartAt: number; searchEndAt: number }
): Promise<Doc<"bookings">[]> {
	const confirmedStatuses = ["confirmed", "email_failed"] as const;

	const confirmedBookingsByStatus = await Promise.all(
		confirmedStatuses.map(async (status) => {
			const bookingsForStatus: Doc<"bookings">[] = [];

			const nearbyBookings = ctx.db
				.query("bookings")
				.withIndex("by_status_and_sessionStartAt", (query) =>
					query
						.eq("status", status)
						.gte("sessionStartAt", args.searchStartAt)
						.lte("sessionStartAt", args.searchEndAt)
				);

			for await (const confirmedBooking of nearbyBookings) {
				bookingsForStatus.push(confirmedBooking);
			}

			return bookingsForStatus;
		})
	);

	return confirmedBookingsByStatus.flat();
}

export async function collectActiveReservationBookings(
	ctx: MutationCtx,
	reservationCreatedAfter: number
): Promise<Doc<"bookings">[]> {
	const activeReservations: Doc<"bookings">[] = [];

	for await (const candidate of ctx.db
		.query("bookings")
		.withIndex("by_reservationCreatedAt", (query) =>
			query.gt("reservationCreatedAt", reservationCreatedAfter)
		)) {
		activeReservations.push(candidate);
	}

	return activeReservations;
}
