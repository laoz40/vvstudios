import { v } from "convex/values";
import type { Doc } from "#convex/_generated/dataModel";

export const SLOT_RESERVATION_TTL_MS = 10 * 60 * 1000;

export const sessionReservationValidator = v.object({
	reservedAt: v.number(),
	sessionStartAt: v.number(),
	duration: v.string()
});

export type SessionReservation = { reservedAt: number; sessionStartAt: number; duration: string };

export type SessionReservationBooking = Pick<
	Doc<"bookings">,
	| "reservationCreatedAt"
	| "reservationSessionStartAt"
	| "reservationDuration"
	| "sessionStartAt"
	| "duration"
>;

export function getReservedTarget(session: SessionReservationBooking) {
	if (session.reservationCreatedAt === undefined) return null;

	return {
		reservedAt: session.reservationCreatedAt,
		sessionStartAt: session.reservationSessionStartAt ?? session.sessionStartAt,
		duration: session.reservationDuration ?? session.duration
	};
}

export function sessionHasReservation(
	session: SessionReservationBooking,
	expected: SessionReservation,
	now?: number
) {
	const reservation = getReservedTarget(session);

	return (
		reservation !== null &&
		reservation.reservedAt === expected.reservedAt &&
		reservation.sessionStartAt === expected.sessionStartAt &&
		reservation.duration === expected.duration &&
		(now === undefined || now - reservation.reservedAt < SLOT_RESERVATION_TTL_MS)
	);
}

export const clearedSessionReservationPatch = {
	reservationCreatedAt: undefined,
	reservationSessionStartAt: undefined,
	reservationDuration: undefined
};
