import { okAsync, type ResultAsync } from "neverthrow";
import type { Doc, Id } from "#convex/_generated/dataModel";
import type { MutationCtx } from "#convex/_generated/server";
import { doSessionWindowsOverlap } from "#convex/sessions/lib/calendarTime";

import {
	collectActiveReservationBookings,
	collectConfirmedBookingsInWindow,
	clearBookingReservationFields,
	writeBookingReservationFields
} from "#convex/sessions/lib/reservationDb";
import {
	getReservedTarget,
	sessionHasReservation,
	SLOT_RESERVATION_TTL_MS,
	type SessionReservation
} from "#convex/sessions/lib/reservations";

export function reservationConflictsWithSlot(args: {
	session: Doc<"bookings">;
	duration: string;
	sessionStartAt: number;
	eventBufferMinutes: number;
	confirmedBookings: Doc<"bookings">[];
	activeReservations: Doc<"bookings">[];
}) {
	const conflictingConfirmedBooking = args.confirmedBookings.some(
		(candidate) =>
			candidate._id !== args.session._id &&
			doSessionWindowsOverlap({
				firstDuration: args.duration,
				firstStartAt: args.sessionStartAt,
				secondDuration: candidate.duration,
				secondStartAt: candidate.sessionStartAt,
				eventBufferMinutes: args.eventBufferMinutes
			})
	);

	const conflictingReservation = args.activeReservations.some((candidate) => {
		if (candidate._id === args.session._id) return false;
		const target = getReservedTarget(candidate);

		if (target === null) return false;

		return doSessionWindowsOverlap({
			firstDuration: args.duration,
			firstStartAt: args.sessionStartAt,
			secondDuration: target.duration,
			secondStartAt: target.sessionStartAt,
			eventBufferMinutes: args.eventBufferMinutes
		});
	});

	return conflictingConfirmedBooking || conflictingReservation;
}

export type ReserveSessionArgs = {
	bookingId: Id<"bookings">;
	duration: string;
	eventBufferMinutes: number;
	now: number;
	sessionStartAt: number;
};

export type ReserveSessionOutcome =
	| { outcome: "unavailable" }
	| { outcome: "reserved"; reservation: SessionReservation };

export type ReservationContext = {
	ctx: MutationCtx;
	args: ReserveSessionArgs;
	session: Doc<"bookings">;
};

const MAX_BOOKING_DURATION_MINUTES = 180;

export function loadConfirmedReservationBookings(context: ReservationContext) {
	const searchPaddingMs =
		(MAX_BOOKING_DURATION_MINUTES + context.args.eventBufferMinutes) * 60 * 1000;

	return collectConfirmedBookingsInWindow(context.ctx, {
		searchStartAt: context.args.sessionStartAt - searchPaddingMs,
		searchEndAt: context.args.sessionStartAt + searchPaddingMs
	}).map((confirmedBookings) => ({ ...context, confirmedBookings }));
}

export function loadActiveReservationBookings(
	context: ReservationContext & { confirmedBookings: Doc<"bookings">[] }
) {
	return collectActiveReservationBookings(
		context.ctx,
		context.args.now - SLOT_RESERVATION_TTL_MS
	).map((activeReservations) => ({ ...context, activeReservations }));
}

export function writeAvailableReservation(
	context: ReservationContext & {
		confirmedBookings: Doc<"bookings">[];
		activeReservations: Doc<"bookings">[];
	}
): ResultAsync<ReserveSessionOutcome, never> {
	const { ctx, args, session, confirmedBookings, activeReservations } = context;

	if (
		reservationConflictsWithSlot({
			session,
			duration: args.duration,
			sessionStartAt: args.sessionStartAt,
			eventBufferMinutes: args.eventBufferMinutes,
			confirmedBookings,
			activeReservations
		})
	)
		return okAsync({ outcome: "unavailable" });

	const reservedAt = Math.max(args.now, (session.reservationCreatedAt ?? 0) + 1);

	const reservation = { reservedAt, sessionStartAt: args.sessionStartAt, duration: args.duration };

	return writeBookingReservationFields(ctx, session._id, {
		reservationCreatedAt: reservation.reservedAt,
		reservationSessionStartAt: reservation.sessionStartAt,
		reservationDuration: reservation.duration
	}).map(() => ({ outcome: "reserved", reservation }));
}

export function clearMatchingReservation(
	ctx: MutationCtx,
	bookingId: Id<"bookings">,
	expected: SessionReservation,
	session: Doc<"bookings"> | null
): ResultAsync<{ cleared: boolean }, never> {
	if (session === null || !sessionHasReservation(session, expected))
		return okAsync({ cleared: false });

	return clearBookingReservationFields(ctx, bookingId).map(() => ({ cleared: true }));
}
