/**
 * These tests cover reserving a new time while a booking update is in progress.
 * They verify that overlapping updates cannot use the same time and that only the
 * request owning the current reservation can finalize or clear it.
 *
 * 1. Overlapping reservations
 *    A booking cannot reserve a time that overlaps another active reservation,
 *    including the configured event buffer.
 *
 * 2. Stale requests
 *    A request with an older reservation cannot clear or save over a newer reservation.
 *
 * 3. Successful finalization
 *    A request with the current reservation can save the new time and remove the
 *    reservation fields from the booking.
 */
import { describe, expect, test } from "vitest";
import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import { createConvexTest } from "../test.setup";

const now = Date.parse("2030-01-01T00:00:00.000Z");
const originalStartAt = Date.parse("2030-01-09T23:00:00.000Z");
const targetStartAt = Date.parse("2030-01-10T23:00:00.000Z");
const laterTargetStartAt = Date.parse("2030-01-11T23:00:00.000Z");
const eventBufferMinutes = 15;

type TestClient = ReturnType<typeof createConvexTest>;

describe("booking time reservations", () => {
	test("atomically blocks another workflow from an overlapping buffered target", async () => {
		const t = createConvexTest();
		const firstBookingId = await seedBooking(t, "confirmed", "first@example.com");
		const secondBookingId = await seedBooking(
			t,
			"email_failed",
			"second@example.com",
			4 * 60 * 60 * 1000
		);

		const firstReservationResult = await createReservation(t, firstBookingId, targetStartAt, now);
		const overlappingReservationResult = await createReservation(
			t,
			secondBookingId,
			targetStartAt + 70 * 60 * 1000,
			now
		);

		expect(firstReservationResult).toMatchObject([null, { outcome: "reserved" }]);
		expect(overlappingReservationResult).toEqual([null, { outcome: "unavailable" }]);
	});

	test("does not let a stale action clear or save over a newer target", async () => {
		const t = createConvexTest();
		const bookingId = await seedBooking(t, "confirmed", "customer@example.com");
		const firstReservationResult = await createReservation(t, bookingId, targetStartAt, now);
		if (firstReservationResult[0] !== null || firstReservationResult[1].outcome !== "reserved") {
			throw new Error("Failed to create first reservation");
		}

		const secondReservationResult = await createReservation(t, bookingId, laterTargetStartAt, now);
		if (secondReservationResult[0] !== null || secondReservationResult[1].outcome !== "reserved") {
			throw new Error("Failed to replace reservation");
		}

		const staleClearResult = await t.mutation(internal.sessionScheduling.clearSessionReservation, {
			bookingId,
			reservation: firstReservationResult[1].reservation
		});
		const staleSaveResult = await t.mutation(
			internal.sessionScheduling.saveClientSessionRescheduleInternal,
			{
				bookingId,
				date: "2030-01-11",
				time: "10:00",
				sessionStartAt: targetStartAt,
				reservation: firstReservationResult[1].reservation
			}
		);
		const booking = await readBooking(t, bookingId);

		expect(staleClearResult).toEqual([null, { cleared: false }]);
		expect(staleSaveResult).toEqual([{ reason: "BOOKING_TIME_UNAVAILABLE" }, null]);
		expect(booking).toMatchObject({
			sessionStartAt: originalStartAt,
			reservationCreatedAt: secondReservationResult[1].reservation.reservedAt,
			reservationSessionStartAt: laterTargetStartAt,
			reservationDuration: "1h"
		});
	});

	test("matching finalization saves the target and clears its reservation", async () => {
		const t = createConvexTest();
		const bookingId = await seedBooking(t, "confirmed", "customer@example.com");
		const reservationResult = await createReservation(t, bookingId, targetStartAt, now);
		if (reservationResult[0] !== null || reservationResult[1].outcome !== "reserved") {
			throw new Error("Failed to reserve target");
		}

		const saveResult = await t.mutation(
			internal.sessionScheduling.saveClientSessionRescheduleInternal,
			{
				bookingId,
				date: "2030-01-11",
				time: "10:00",
				sessionStartAt: targetStartAt,
				reservation: reservationResult[1].reservation
			}
		);
		const booking = await readBooking(t, bookingId);

		expect(saveResult).toEqual([null, { saved: true }]);
		expect(booking).toMatchObject({ sessionStartAt: targetStartAt });
		expect(booking?.reservationCreatedAt).toBeUndefined();
		expect(booking?.reservationSessionStartAt).toBeUndefined();
		expect(booking?.reservationDuration).toBeUndefined();
	});
});

async function createReservation(
	t: TestClient,
	bookingId: Id<"bookings">,
	sessionStartAt: number,
	at: number
) {
	return await t.mutation(internal.sessionScheduling.reserveSessionReservation, {
		bookingId,
		duration: "1h",
		eventBufferMinutes,
		now: at,
		sessionStartAt
	});
}

async function seedBooking(
	t: TestClient,
	status: "confirmed" | "email_failed",
	email: string,
	startOffset = 0
) {
	return await t.run((ctx) =>
		ctx.db.insert("bookings", {
			name: "Test customer",
			phone: "0400000000",
			accountName: "Test account",
			email,
			date: "2030-01-10",
			time: "10:00",
			sessionStartAt: originalStartAt + startOffset,
			duration: "1h",
			service: "Remote Podcast",
			addons: [],
			status,
			pendingPaymentCreatedAt: now
		})
	);
}

async function readBooking(t: TestClient, bookingId: Id<"bookings">) {
	return await t.run((ctx) => ctx.db.get(bookingId));
}
