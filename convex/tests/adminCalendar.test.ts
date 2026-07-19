/**
 * These tests cover editing and deleting confirmed bookings from the admin dashboard.
 * They verify that Google Calendar and Convex stay synchronized throughout both workflows.
 *
 * 1. Editing an existing Calendar event
 *    A timing and customer details edit must update the linked Google event and save the
 *    same booking details in Convex while preserving its Calendar IDs.
 *
 * 2. Replacing a missing Calendar event
 *    If the saved Google event no longer exists, the edit must create a replacement and
 *    store its new Calendar and event IDs with the updated booking.
 *
 * 3. Calendar deletion failure
 *    A provider failure must leave the booking confirmed with its Calendar IDs intact.
 *
 * 4. Successful or already-completed Calendar deletion
 *    A deleted or already-missing Google event must cancel the booking and clear its
 *    Calendar IDs so Convex does not retain a stale active booking.
 *
 * Google Calendar is replaced with fakes, so no real provider requests are made.
 */
import { beforeEach, describe, expect, test, vi } from "vitest";
import { api } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import { createConvexTest } from "../test.setup";

const providerFakes = vi.hoisted(() => ({
	deleteEvent: vi.fn(),
	getEvent: vi.fn(),
	insertEvent: vi.fn(),
	listEvents: vi.fn(),
	patchEvent: vi.fn()
}));

vi.mock("../env", () => ({ env: { GOOGLE_CALENDAR_TIMEZONE: "Australia/Sydney" } }));

vi.mock("../lib/googleCalendarClient", () => ({
	getGoogleCalendarClient: () => ({
		calendarId: "primary-calendar",
		calendarIds: ["primary-calendar"],
		timeZone: "Australia/Sydney",
		calendar: {
			events: {
				delete: providerFakes.deleteEvent,
				get: providerFakes.getEvent,
				insert: providerFakes.insertEvent,
				list: providerFakes.listEvents,
				patch: providerFakes.patchEvent
			}
		}
	})
}));

const now = Date.parse("2030-01-01T00:00:00.000Z");
const originalSessionStartAt = Date.parse("2030-01-09T23:00:00.000Z");
const updatedSessionStartAt = Date.parse("2030-01-10T23:00:00.000Z");
const adminIdentity = { publicMetadata: { role: "admin" } };

type TestClient = ReturnType<typeof createConvexTest>;

beforeEach(() => {
	vi.clearAllMocks();
	vi.spyOn(Date, "now").mockReturnValue(now);
	providerFakes.deleteEvent.mockResolvedValue({ data: {} });
	providerFakes.getEvent.mockResolvedValue({ data: { status: "confirmed" } });
	providerFakes.insertEvent.mockResolvedValue({ data: { id: "replacement-event" } });
	providerFakes.listEvents.mockResolvedValue({ data: { items: [] } });
	providerFakes.patchEvent.mockResolvedValue({ data: {} });
});

describe("admin booking Calendar edits", () => {
	test("updates the Calendar event and matching Convex booking fields", async () => {
		const t = createConvexTest();
		const bookingId = await seedConfirmedBooking(t);

		const result = await updateBooking(t, bookingId);
		const booking = await readBooking(t, bookingId);

		expect(result).toEqual([null, { ok: true }]);
		expect(providerFakes.patchEvent).toHaveBeenCalledTimes(1);
		expect(providerFakes.patchEvent).toHaveBeenCalledWith(
			expect.objectContaining({ calendarId: "saved-calendar", eventId: "saved-event" })
		);
		expect(booking).toMatchObject({
			date: "2030-01-11",
			duration: "2h",
			email: "updated@example.com",
			googleCalendarId: "saved-calendar",
			googleEventId: "saved-event",
			name: "Updated customer",
			sessionStartAt: updatedSessionStartAt,
			time: "10:00"
		});
	});

	test("stores replacement Calendar IDs when the original event is missing", async () => {
		const t = createConvexTest();
		const bookingId = await seedConfirmedBooking(t);
		providerFakes.getEvent.mockRejectedValue({ response: { status: 404 } });

		const result = await updateBooking(t, bookingId);

		expect(result).toEqual([null, { googleOutcome: "replacementCreated", ok: true }]);
		expect(providerFakes.insertEvent).toHaveBeenCalledTimes(1);
		expect(await readBooking(t, bookingId)).toMatchObject({
			googleCalendarId: "primary-calendar",
			googleEventId: "replacement-event",
			sessionStartAt: updatedSessionStartAt
		});
	});
});

describe("admin booking Calendar deletion", () => {
	test("leaves the booking active when Calendar deletion fails", async () => {
		const t = createConvexTest();
		const bookingId = await seedConfirmedBooking(t);
		const before = await readBooking(t, bookingId);
		providerFakes.deleteEvent.mockRejectedValue(new Error("Calendar unavailable"));

		const result = await deleteBooking(t, bookingId);

		expect(result).toEqual([{ reason: "GOOGLE_CALENDAR_DELETE_FAILED" }, null]);
		expect(await readBooking(t, bookingId)).toEqual(before);
	});

	test("cancels the booking and clears Calendar IDs after deletion", async () => {
		const t = createConvexTest();
		const bookingId = await seedConfirmedBooking(t);

		const result = await deleteBooking(t, bookingId);
		const booking = await readBooking(t, bookingId);

		expect(result).toEqual([null, { deleted: true }]);
		expect(providerFakes.deleteEvent).toHaveBeenCalledTimes(1);
		expect(booking).toMatchObject({ status: "cancelled" });
		expect(booking?.googleCalendarId).toBeUndefined();
		expect(booking?.googleEventId).toBeUndefined();
	});

	test("cancels the booking when the Calendar event is already missing", async () => {
		const t = createConvexTest();
		const bookingId = await seedConfirmedBooking(t);
		providerFakes.deleteEvent.mockRejectedValue({ response: { status: 404 } });

		const result = await deleteBooking(t, bookingId);
		const booking = await readBooking(t, bookingId);

		expect(result).toEqual([null, { deleted: true }]);
		expect(providerFakes.listEvents).toHaveBeenCalledTimes(1);
		expect(booking).toMatchObject({ status: "cancelled" });
		expect(booking?.googleCalendarId).toBeUndefined();
		expect(booking?.googleEventId).toBeUndefined();
	});
});

async function seedConfirmedBooking(t: TestClient) {
	return await t.run(async (ctx) => {
		await ctx.db.insert("bookingSettings", {
			key: "main",
			leadTimeMinutes: 60,
			eventBufferMinutes: 15,
			maxDaysAhead: 30,
			weekSchedule: Array.from({ length: 7 }, () => ({ startTime: "09:00", endTime: "17:00" })),
			updatedAt: now
		});

		return await ctx.db.insert("bookings", {
			name: "Original customer",
			phone: "0400000000",
			accountName: "Original account",
			email: "original@example.com",
			date: "2030-01-10",
			time: "10:00",
			sessionStartAt: originalSessionStartAt,
			duration: "1h",
			service: "Remote Podcast",
			addons: [],
			status: "confirmed",
			pendingPaymentCreatedAt: now,
			googleCalendarId: "saved-calendar",
			googleEventId: "saved-event"
		});
	});
}

async function updateBooking(t: TestClient, bookingId: Id<"bookings">) {
	return await t
		.withIdentity(adminIdentity)
		.action(api.googleCalendar.updateBookingFromAdmin, {
			bookingId,
			name: "Updated customer",
			phone: "0411111111",
			accountName: "Updated account",
			email: "updated@example.com",
			date: "2030-01-11",
			time: "10:00",
			duration: "2h",
			service: "Remote Podcast",
			addons: []
		});
}

async function deleteBooking(t: TestClient, bookingId: Id<"bookings">) {
	return await t
		.withIdentity(adminIdentity)
		.action(api.googleCalendar.deleteBookingFromAdmin, { bookingId });
}

async function readBooking(t: TestClient, bookingId: Id<"bookings">) {
	return await t.run((ctx) => ctx.db.get(bookingId));
}
