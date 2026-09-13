/**
 * Session reservation matching and overlap checks.
 *
 * 1. sessionHasReservation
 *    Rejects stale ids, changed targets, expired TTLs, and uses session field fallbacks.
 *
 * 2. doSessionWindowsOverlap
 *    Detects direct overlaps and buffer gaps between session windows.
 */
import { describe, expect, test } from "vitest";
import { doSessionWindowsOverlap } from "#convex/lib/sessionCalendarTime";
import {
	sessionHasReservation,
	SLOT_RESERVATION_TTL_MS,
	type SessionReservation,
	type SessionReservationBooking
} from "#convex/lib/sessionReservations";

const now = Date.parse("2030-01-01T00:00:00.000Z");

const sessionStartAt = Date.parse("2030-01-10T23:00:00.000Z");

const MILLISECONDS_PER_HOUR = 60 * 60 * 1000;

const eventBufferMinutes = 15;

const reservation: SessionReservation = { reservedAt: now, sessionStartAt, duration: "1h" };

function bookingWithReservation(
	overrides: Partial<SessionReservationBooking> = {}
): SessionReservationBooking {
	return {
		sessionStartAt,
		duration: "1h",
		reservationCreatedAt: reservation.reservedAt,
		reservationSessionStartAt: reservation.sessionStartAt,
		reservationDuration: reservation.duration,
		...overrides
	};
}

describe("sessionHasReservation", () => {
	test("returns true when reservation fields fall back to the session time and duration", () => {
		const session = bookingWithReservation({
			reservationSessionStartAt: undefined,
			reservationDuration: undefined
		});

		expect(sessionHasReservation(session, reservation, now)).toBe(true);
	});

	test("returns false for a stale reservedAt", () => {
		expect(
			sessionHasReservation(bookingWithReservation(), { ...reservation, reservedAt: now - 1 }, now)
		).toBe(false);
	});

	test("returns false when the reserved sessionStartAt changed", () => {
		expect(
			sessionHasReservation(
				bookingWithReservation(),
				{ ...reservation, sessionStartAt: sessionStartAt + MILLISECONDS_PER_HOUR },
				now
			)
		).toBe(false);
	});

	test("returns false when the reserved duration changed", () => {
		expect(
			sessionHasReservation(bookingWithReservation(), { ...reservation, duration: "2h" }, now)
		).toBe(false);
	});

	test("returns false once the reservation TTL has expired", () => {
		expect(
			sessionHasReservation(bookingWithReservation(), reservation, now + SLOT_RESERVATION_TTL_MS)
		).toBe(false);
	});
});

describe("doSessionWindowsOverlap", () => {
	test("returns false when buffered session windows are far apart", () => {
		const overlaps = doSessionWindowsOverlap({
			firstDuration: "1h",
			firstStartAt: sessionStartAt,
			secondDuration: "1h",
			secondStartAt: sessionStartAt + 2 * MILLISECONDS_PER_HOUR,
			eventBufferMinutes
		});

		expect(overlaps).toBe(false);
	});

	test("returns true when session windows overlap directly", () => {
		const overlaps = doSessionWindowsOverlap({
			firstDuration: "1h",
			firstStartAt: sessionStartAt,
			secondDuration: "1h",
			secondStartAt: sessionStartAt + MILLISECONDS_PER_HOUR,
			eventBufferMinutes
		});

		expect(overlaps).toBe(true);
	});

	test("returns true when only the event buffer overlaps", () => {
		const overlaps = doSessionWindowsOverlap({
			firstDuration: "1h",
			firstStartAt: sessionStartAt,
			secondDuration: "1h",
			secondStartAt: sessionStartAt + MILLISECONDS_PER_HOUR + 14 * 60 * 1000,
			eventBufferMinutes
		});

		expect(overlaps).toBe(true);
	});
});
