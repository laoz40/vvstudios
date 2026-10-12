import { ok, safeTry } from "neverthrow";
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
	return safeTry(async function* () {
		const session = yield* getSessionFromDb(ctx, args.bookingId);
		const reservationInput = { ctx, args, session };
		const confirmedBookings = yield* loadConfirmedReservationBookings(reservationInput);
		const activeBookings = yield* loadActiveReservationBookings(confirmedBookings);

		return ok(yield* writeAvailableReservation(activeBookings));
	});
}

export function unreserveSessionTime(
	ctx: MutationCtx,
	bookingId: Id<"bookings">,
	expected: SessionReservation
) {
	return safeTry(async function* () {
		const session = yield* getBookingRow(ctx, bookingId);

		return ok(yield* clearMatchingReservation(ctx, bookingId, expected, session));
	});
}
