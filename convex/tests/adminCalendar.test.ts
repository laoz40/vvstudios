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
 * 3. Calendar conflicts
 *    Admin edits may bypass opening hours, but a busy Google Calendar slot must still reject
 *    the edit without changing the booking.
 *
 * 4. Recovering a booking that payment could not confirm
 *    If checkout was paid but the time became unavailable or Calendar event creation failed,
 *    an admin can choose a valid time to create the missing event and confirm the booking.
 *    The booking stays failed when the new time is busy or Calendar creation still fails.
 *
 * 5. Reminder state and remaining balance edits
 *    Moving a session clears its old reminder result so a reminder can be sent for the new time.
 *    Editing only customer details keeps the existing reminder result. Pricing changes calculate
 *    a new remaining balance, while a valid manual balance is kept and a negative one is rejected.
 *
 * 6. Calendar deletion failure
 *    A provider failure must leave the booking confirmed with its Calendar IDs intact.
 *
 * 7. Successful or already-completed Calendar deletion
 *    A deleted or already-missing Google event must cancel the booking and clear its
 *    Calendar IDs so Convex does not retain a stale active booking.
 *
 * Google Calendar is replaced with fakes, so no real provider requests are made.
 */
import { ok } from "neverthrow";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { api, internal } from "#convex/_generated/api";
import type { Id } from "#convex/_generated/dataModel";
import { createConvexTest } from "#convex/test.setup";

const providerFakes = vi.hoisted(() => ({
	deleteEvent: vi.fn(),
	getEvent: vi.fn(),
	insertEvent: vi.fn(),
	listEvents: vi.fn(),
	patchEvent: vi.fn()
}));

vi.mock("#convex/env", () => ({ env: { GOOGLE_CALENDAR_TIMEZONE: "Australia/Sydney" } }));

vi.mock("#convex/lib/googleCalendarClient", () => {
	const getClient = () => ({
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
	});

	return { getGoogleCalendarClient: getClient, loadGoogleCalendarClient: () => ok(getClient()) };
});

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
	test("rejects a conflicting Calendar slot without changing the booking", async () => {
		const t = createConvexTest();
		const bookingId = await seedConfirmedBooking(t);
		const before = await readBooking(t, bookingId);
		providerFakes.listEvents.mockResolvedValue({
			data: {
				items: [
					{
						id: "conflicting-event",
						start: { dateTime: "2030-01-10T23:00:00.000Z" },
						end: { dateTime: "2030-01-11T01:00:00.000Z" }
					}
				]
			}
		});

		const result = await updateBooking(t, bookingId);

		expect(result).toEqual([{ reason: "BOOKING_TIME_UNAVAILABLE" }, null]);
		expect(await readBooking(t, bookingId)).toEqual(before);
		expect(providerFakes.patchEvent).not.toHaveBeenCalled();
		expect(providerFakes.insertEvent).not.toHaveBeenCalled();
	});

	test("updates the Calendar event and matching Convex booking fields", async () => {
		const t = createConvexTest();
		const bookingId = await seedConfirmedBooking(t);

		const result = await updateBooking(t, bookingId);
		const booking = await readBooking(t, bookingId);

		expect(result).toEqual([null, {}]);
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

		expect(result).toEqual([null, { googleOutcome: "replacementCreated" }]);
		expect(providerFakes.insertEvent).toHaveBeenCalledTimes(1);
		expect(await readBooking(t, bookingId)).toMatchObject({
			googleCalendarId: "primary-calendar",
			googleEventId: "replacement-event",
			sessionStartAt: updatedSessionStartAt
		});
	});
});

describe("admin failed booking recovery", () => {
	test.each(["BOOKING_TIME_UNAVAILABLE", "GOOGLE_CALENDAR_CREATE_FAILED"] as const)(
		"recovers a booking with %s",
		async (bookingFailureCode) => {
			const t = createConvexTest();
			const bookingId = await seedFailedBooking(t, bookingFailureCode);

			const result = await updateBooking(t, bookingId);
			const booking = await readBooking(t, bookingId);

			expect(result).toEqual([null, { googleOutcome: "createdFromFailed" }]);
			expect(booking).toMatchObject({
				status: "confirmed",
				bookingConfirmedAt: now,
				googleCalendarId: "primary-calendar",
				googleEventId: "replacement-event"
			});
			expect(booking?.bookingFailureCode).toBeUndefined();
			expect(providerFakes.insertEvent).toHaveBeenCalledTimes(1);
			expect(providerFakes.patchEvent).not.toHaveBeenCalled();
		}
	);

	test("leaves a failed booking unchanged when its target is busy", async () => {
		const t = createConvexTest();
		const bookingId = await seedFailedBooking(t, "BOOKING_TIME_UNAVAILABLE");
		const before = await readBooking(t, bookingId);
		providerFakes.listEvents.mockResolvedValue({
			data: {
				items: [
					{
						id: "conflicting-event",
						start: { dateTime: "2030-01-10T23:00:00.000Z" },
						end: { dateTime: "2030-01-11T01:00:00.000Z" }
					}
				]
			}
		});

		const result = await updateBooking(t, bookingId);

		expect(result).toEqual([{ reason: "BOOKING_TIME_UNAVAILABLE" }, null]);
		expect(await readBooking(t, bookingId)).toEqual(before);
		expect(providerFakes.insertEvent).not.toHaveBeenCalled();
	});

	test("leaves a failed booking unchanged when Calendar creation fails", async () => {
		const t = createConvexTest();
		const bookingId = await seedFailedBooking(t, "GOOGLE_CALENDAR_CREATE_FAILED");
		const before = await readBooking(t, bookingId);
		providerFakes.insertEvent.mockRejectedValue(new Error("Calendar unavailable"));

		const result = await updateBooking(t, bookingId);

		expect(result).toEqual([{ reason: "GOOGLE_CALENDAR_CREATE_FAILED" }, null]);
		expect(await readBooking(t, bookingId)).toEqual(before);
	});
});

describe("admin booking state integrity", () => {
	test("resets reminders for timing edits and preserves them for ordinary edits", async () => {
		const timingTest = createConvexTest();
		const timingBookingId = await seedConfirmedBooking(timingTest);
		const timingResult = await timingTest.mutation(
			internal.sessionScheduling.saveAdminSessionUpdate,
			adminBookingValues(timingBookingId, { date: "2030-01-11" })
		);
		const timingBooking = await readBooking(timingTest, timingBookingId);

		expect(timingResult).toEqual([null, null]);
		expect(timingBooking?.reminderEmailClaimedAt).toBeUndefined();
		expect(timingBooking?.reminderEmailSentAt).toBeUndefined();
		expect(timingBooking?.reminderEmailFailureCode).toBeUndefined();

		const ordinaryTest = createConvexTest();
		const ordinaryBookingId = await seedConfirmedBooking(ordinaryTest);
		const ordinaryResult = await ordinaryTest.mutation(
			internal.sessionScheduling.saveAdminSessionUpdate,
			adminBookingValues(ordinaryBookingId, { name: "Ordinary edit" })
		);
		const ordinaryBooking = await readBooking(ordinaryTest, ordinaryBookingId);

		expect(ordinaryResult).toEqual([null, null]);
		expect(ordinaryBooking).toMatchObject({
			reminderEmailClaimedAt: now - 3,
			reminderEmailSentAt: now - 2,
			reminderEmailFailureCode: "SEND_FAILED"
		});
	});

	test("recalculates financial edits and respects a valid override", async () => {
		const t = createConvexTest();
		const bookingId = await seedConfirmedBooking(t);
		const admin = t.withIdentity(adminIdentity);

		const recalculationResult = await admin.action(
			api.googleCalendar.updateSessionFromAdmin,
			adminBookingValues(bookingId, {
				duration: "2h",
				addons: ["Essential Edit", "Clips Package"],
				essentialEditQuantity: "2",
				clipsPackageQuantity: "3"
			})
		);

		expect(recalculationResult).toEqual([null, {}]);
		expect(await readBooking(t, bookingId)).toMatchObject({
			duration: "2h",
			addons: ["Essential Edit", "Clips Package"],
			essentialEditQuantity: "2",
			clipsPackageQuantity: "3",
			remainingBalanceAmount: 684
		});

		const overrideResult = await admin.action(
			api.googleCalendar.updateSessionFromAdmin,
			adminBookingValues(bookingId, { remainingBalanceAmount: 111.25 })
		);

		expect(overrideResult).toEqual([null, {}]);
		expect((await readBooking(t, bookingId))?.remainingBalanceAmount).toBe(111.25);
	});

	test("rejects a negative balance override without changing the booking", async () => {
		const t = createConvexTest();
		const bookingId = await seedConfirmedBooking(t);
		const before = await readBooking(t, bookingId);

		const result = await t
			.withIdentity(adminIdentity)
			.action(
				api.googleCalendar.updateSessionFromAdmin,
				adminBookingValues(bookingId, { remainingBalanceAmount: -1 })
			);

		expect(result).toEqual([{ reason: "BOOKING_INVALID_INPUT" }, null]);
		expect(await readBooking(t, bookingId)).toEqual(before);
		expect(providerFakes.patchEvent).not.toHaveBeenCalled();
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
			googleEventId: "saved-event",
			reminderEmailClaimedAt: now - 3,
			reminderEmailSentAt: now - 2,
			reminderEmailFailureCode: "SEND_FAILED",
			remainingBalanceAmount: 249
		});
	});
}

async function seedFailedBooking(t: TestClient, bookingFailureCode: string) {
	const bookingId = await seedConfirmedBooking(t);
	await t.run((ctx) =>
		ctx.db.patch(bookingId, {
			status: "failed",
			bookingFailureCode,
			googleCalendarId: undefined,
			googleEventId: undefined
		})
	);
	return bookingId;
}

function adminBookingValues(
	bookingId: Id<"bookings">,
	overrides: Partial<{
		name: string;
		phone: string;
		accountName: string;
		email: string;
		date: string;
		duration: string;
		addons: string[];
		essentialEditQuantity: string;
		clipsPackageQuantity: string;
		remainingBalanceAmount: number;
	}> = {}
) {
	return {
		bookingId,
		name: "Original customer",
		phone: "0400000000",
		accountName: "Original account",
		email: "original@example.com",
		date: "2030-01-10",
		time: "10:00",
		duration: "1h",
		service: "Remote Podcast",
		addons: [],
		...overrides
	};
}

async function updateBooking(t: TestClient, bookingId: Id<"bookings">) {
	return await t
		.withIdentity(adminIdentity)
		.action(
			api.googleCalendar.updateSessionFromAdmin,
			adminBookingValues(bookingId, {
				name: "Updated customer",
				phone: "0411111111",
				accountName: "Updated account",
				email: "updated@example.com",
				date: "2030-01-11",
				duration: "2h"
			})
		);
}

async function deleteBooking(t: TestClient, bookingId: Id<"bookings">) {
	return await t
		.withIdentity(adminIdentity)
		.action(api.googleCalendar.deleteSessionFromAdmin, { bookingId });
}

async function readBooking(t: TestClient, bookingId: Id<"bookings">) {
	return await t.run((ctx) => ctx.db.get(bookingId));
}
