import type { Id } from "#convex/_generated/dataModel";
import type { MutationCtx } from "#convex/_generated/server";
import { getBookingRow } from "#convex/sessions/lib/lookup";
import type { SessionReservation } from "#convex/sessions/lib/reservations";
import {
	loadConfirmedReservationBookings,
	loadActiveReservationBookings,
	writeAvailableReservation,
	clearMatchingReservation,
	type ReserveSessionArgs
} from "#convex/sessions/lib/reservationsSteps";
import { getSessionFromDb } from "#convex/sessions/services/lookup";

export function reserveSessionTime(ctx: MutationCtx, args: ReserveSessionArgs) {
	return getSessionFromDb(ctx, args.bookingId)
		.map((session) => ({ ctx, args, session }))
		.andThen(loadConfirmedReservationBookings)
		.andThen(loadActiveReservationBookings)
		.andThen(writeAvailableReservation);
}

export function unreserveSessionTime(
	ctx: MutationCtx,
	bookingId: Id<"bookings">,
	expected: SessionReservation
) {
	return getBookingRow(ctx, bookingId).andThen((session) =>
		clearMatchingReservation(ctx, bookingId, expected, session)
	);
}
