/**
 * Admin session save outcomes through saveAdminSessionUpdate.
 *
 * 1. Timing edits
 *    Date, time, and duration updates persist and clear reminder email state.
 *
 * 2. Non-timing edits
 *    Name and notes update without touching reminder fields.
 *
 * 3. Pricing fields
 *    Add-ons and quantity fields persist on the booking.
 *
 * 4. Email normalization
 *    Stored email is trimmed and lowercased.
 *
 * 5. Expired reservation
 *    Stale reservations return BOOKING_TIME_UNAVAILABLE without mutating the booking.
 *
 * 6. Failed to confirmed
 *    confirmBooking promotes failed bookings to confirmed and clears failure codes.
 */
import { beforeEach, describe, expect, test, vi } from "vitest";
import { internal } from "#convex/_generated/api";
import type { Id } from "#convex/_generated/dataModel";
import type { BookingAddon } from "#studio/features/booking-form/lib/booking-form-model";
import { SLOT_RESERVATION_TTL_MS } from "#convex/lib/sessionReservations";
import { createConvexTest } from "#convex/test.setup";

const now = Date.parse("2030-01-01T00:00:00.000Z");

const originalSessionStartAt = Date.parse("2030-01-09T23:00:00.000Z");

const rescheduledSessionStartAt = Date.parse("2030-01-10T23:00:00.000Z");

type TestClient = ReturnType<typeof createConvexTest>;

beforeEach(() => {
	vi.spyOn(Date, "now").mockReturnValue(now);
});

describe("saveAdminSessionUpdate", () => {
	test("persists timing edits and clears reminder fields", async () => {
		const t = createConvexTest();

		const bookingId = await seedBooking(t, {
			reminderEmailClaimedAt: now - 60_000,
			reminderEmailSentAt: now - 30_000,
			reminderEmailFailureCode: "SEND_FAILED"
		});

		const result = await saveAdminUpdate(t, bookingId, {
			date: "2030-01-11",
			time: "10:00",
			duration: "2h"
		});

		const booking = await readBooking(t, bookingId);

		expect(result).toEqual([null, null]);
		expect(booking).toMatchObject({
			date: "2030-01-11",
			time: "10:00",
			duration: "2h",
			sessionStartAt: rescheduledSessionStartAt
		});
		expect(booking?.reminderEmailClaimedAt).toBeUndefined();
		expect(booking?.reminderEmailSentAt).toBeUndefined();
		expect(booking?.reminderEmailFailureCode).toBeUndefined();
	});

	test("updates non-timing fields without clearing reminder state", async () => {
		const t = createConvexTest();

		const bookingId = await seedBooking(t, {
			reminderEmailClaimedAt: now - 60_000,
			reminderEmailSentAt: now - 30_000
		});

		const result = await saveAdminUpdate(t, bookingId, {
			name: "Updated name",
			notes: "Updated notes"
		});

		const booking = await readBooking(t, bookingId);

		expect(result).toEqual([null, null]);
		expect(booking).toMatchObject({
			name: "Updated name",
			notes: "Updated notes",
			date: "2030-01-10",
			time: "10:00",
			duration: "1h",
			sessionStartAt: originalSessionStartAt,
			reminderEmailClaimedAt: now - 60_000,
			reminderEmailSentAt: now - 30_000
		});
	});

	test("persists add-on and quantity pricing fields", async () => {
		const t = createConvexTest();
		const bookingId = await seedBooking(t);

		const result = await saveAdminUpdate(t, bookingId, {
			addons: ["Teleprompter", "Essential Edit"] satisfies BookingAddon[],
			essentialEditQuantity: "2"
		});

		const booking = await readBooking(t, bookingId);

		expect(result).toEqual([null, null]);
		expect(booking).toMatchObject({
			addons: ["Teleprompter", "Essential Edit"],
			essentialEditQuantity: "2"
		});
	});

	test("stores normalized email", async () => {
		const t = createConvexTest();
		const bookingId = await seedBooking(t);

		const result = await saveAdminUpdate(t, bookingId, { email: "  Admin.User@Example.COM  " });

		const booking = await readBooking(t, bookingId);

		expect(result).toEqual([null, null]);
		expect(booking?.email).toBe("admin.user@example.com");
	});

	test("rejects an expired reservation without changing the booking", async () => {
		const t = createConvexTest();
		const staleReservedAt = now - SLOT_RESERVATION_TTL_MS - 1;

		const bookingId = await seedBooking(t, {
			reservationCreatedAt: staleReservedAt,
			reservationSessionStartAt: rescheduledSessionStartAt,
			reservationDuration: "2h"
		});

		const before = await readBooking(t, bookingId);

		const result = await saveAdminUpdate(
			t,
			bookingId,
			{ date: "2030-01-11", time: "10:00", duration: "2h" },
			{
				reservation: {
					reservedAt: staleReservedAt,
					sessionStartAt: rescheduledSessionStartAt,
					duration: "2h"
				}
			}
		);

		expect(result).toEqual([{ reason: "BOOKING_TIME_UNAVAILABLE" }, null]);
		expect(await readBooking(t, bookingId)).toEqual(before);
	});

	test("promotes a failed booking to confirmed when confirmBooking is set", async () => {
		const t = createConvexTest();

		const bookingId = await seedBooking(t, {
			status: "failed",
			bookingFailureCode: "GOOGLE_CALENDAR_CREATE_FAILED"
		});

		const result = await saveAdminUpdate(
			t,
			bookingId,
			{},
			{ confirmBooking: true, googleCalendarId: "cal-1", googleEventId: "evt-1" }
		);

		const booking = await readBooking(t, bookingId);

		expect(result).toEqual([null, null]);
		expect(booking).toMatchObject({
			status: "confirmed",
			googleCalendarId: "cal-1",
			googleEventId: "evt-1",
			bookingConfirmedAt: now
		});
		expect(booking?.bookingFailureCode).toBeUndefined();
	});
});

type SeedBookingOverrides = {
	status?: "confirmed" | "failed";
	bookingFailureCode?: string;
	reminderEmailClaimedAt?: number;
	reminderEmailSentAt?: number;
	reminderEmailFailureCode?: string;
	reservationCreatedAt?: number;
	reservationSessionStartAt?: number;
	reservationDuration?: string;
};

async function seedBooking(t: TestClient, overrides: SeedBookingOverrides = {}) {
	return await t.run((ctx) =>
		ctx.db.insert("bookings", {
			name: "Test customer",
			phone: "0400000000",
			accountName: "Test account",
			email: "customer@example.com",
			date: "2030-01-10",
			time: "10:00",
			sessionStartAt: originalSessionStartAt,
			duration: "1h",
			service: "Table Setup",
			addons: [],
			status: overrides.status ?? "confirmed",
			pendingPaymentCreatedAt: now,
			...overrides
		})
	);
}

type AdminUpdateOverrides = {
	name?: string;
	phone?: string;
	accountName?: string;
	email?: string;
	date?: string;
	time?: string;
	duration?: string;
	service?: string;
	addons?: BookingAddon[];
	essentialEditQuantity?: string;
	notes?: string;
};

type SaveOptions = {
	confirmBooking?: boolean;
	googleCalendarId?: string;
	googleEventId?: string;
	reservation?: { reservedAt: number; sessionStartAt: number; duration: string };
};

async function saveAdminUpdate(
	t: TestClient,
	bookingId: Id<"bookings">,
	overrides: AdminUpdateOverrides,
	options: SaveOptions = {}
) {
	return await t.mutation(internal.sessionScheduling.saveAdminSessionUpdate, {
		bookingId,
		name: overrides.name ?? "Test customer",
		phone: overrides.phone ?? "0400000000",
		accountName: overrides.accountName ?? "Test account",
		email: overrides.email ?? "customer@example.com",
		date: overrides.date ?? "2030-01-10",
		time: overrides.time ?? "10:00",
		duration: overrides.duration ?? "1h",
		service: overrides.service ?? "Table Setup",
		addons: overrides.addons ?? [],
		essentialEditQuantity: overrides.essentialEditQuantity,
		notes: overrides.notes,
		confirmBooking: options.confirmBooking,
		googleCalendarId: options.googleCalendarId,
		googleEventId: options.googleEventId,
		reservation: options.reservation
	});
}

async function readBooking(t: TestClient, bookingId: Id<"bookings">) {
	return await t.run((ctx) => ctx.db.get(bookingId));
}
