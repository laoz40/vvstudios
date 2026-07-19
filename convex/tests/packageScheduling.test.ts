/**
 * These tests cover creating package sessions from a customer scheduling link.
 * They verify that invalid requests have no side effects, successful requests
 * keep Convex and Google Calendar in sync, and partial failures are compensated.
 *
 * 1. Invalid scheduling token
 *    An unknown token cannot select a package or create any records. The token
 *    is a random secret whose hash is stored on the package; it is not a package ID.
 *
 * 2. Expired package
 *    A package cannot schedule another session at or after its expiry time.
 *
 * 3. Package capacity
 *    A package with all purchased sessions already scheduled cannot add another.
 *
 * 4. Unavailable time
 *    A time that overlaps an existing Calendar event cannot create a booking or
 *    another Calendar event.
 *
 * 5. Successful scheduling
 *    One matching Calendar event and confirmed Convex booking are created with
 *    the package snapshot, session choices, package link, and Calendar IDs.
 *
 * 6. Concurrent final-slot requests
 *    When two requests race for the last package session, only one booking wins
 *    and the Calendar event created by the losing request is deleted.
 *
 * 7. Cleanup when saving fails
 *    Tests two requests competing for the final package slot. The request that
 *    saves its Convex booking first keeps its Calendar event. The losing request,
 *    which already created a Calendar event, deletes its own event.
 *
 * Google Calendar and rate limits are replaced with fakes, so no real provider
 * requests are made and these tests exercise only package scheduling behavior.
 */
import { beforeEach, describe, expect, test, vi } from "vitest";
import { api } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import { hashRescheduleToken } from "../lib/bookingRescheduleLinks";
import { createConvexTest } from "../test.setup";

const providerFakes = vi.hoisted(() => ({
	deleteEvent: vi.fn(),
	insertEvent: vi.fn(),
	listEvents: vi.fn()
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
				insert: providerFakes.insertEvent,
				list: providerFakes.listEvents
			}
		}
	})
}));

vi.mock("../lib/rateLimits", () => ({
	checkBookingSubmitRateLimit: vi.fn().mockResolvedValue([null, { allowed: true }]),
	checkGoogleCalendarAvailabilityRateLimit: vi.fn().mockResolvedValue([null, { allowed: true }])
}));

const now = Date.parse("2030-01-01T00:00:00.000Z");
const target = {
	date: "2030-01-11",
	time: "10:00",
	service: "Table Setup" as const,
	remotePodcast: false
};

type TestClient = ReturnType<typeof createConvexTest>;

beforeEach(() => {
	vi.clearAllMocks();
	vi.spyOn(Date, "now").mockReturnValue(now);
	providerFakes.deleteEvent.mockResolvedValue({ data: {} });
	providerFakes.insertEvent.mockResolvedValue({ data: { id: "google-event-1" } });
	providerFakes.listEvents.mockResolvedValue({ data: { items: [] } });
});

describe("package session creation validation", () => {
	test("rejects an invalid token without creating records", async () => {
		const t = createConvexTest();

		const result = await t.action(api.packageScheduling.createPackageBooking, {
			token: "unknown-token",
			...target
		});

		expect(result).toEqual([{ reason: "PACKAGE_LINK_INVALID" }, null]);
		await expectNoBookingOrCalendarEvent(t);
	});

	test("rejects an expired package without creating records", async () => {
		const t = createConvexTest();
		const { token } = await seedPackage(t, { expiresAt: now });

		const result = await t.action(api.packageScheduling.createPackageBooking, { token, ...target });

		expect(result).toEqual([{ reason: "PACKAGE_LINK_EXPIRED" }, null]);
		await expectNoBookingOrCalendarEvent(t);
	});

	test("rejects a package with every session scheduled without creating another record", async () => {
		const t = createConvexTest();
		const { packageId, token } = await seedPackage(t);
		for (let index = 0; index < 4; index += 1) {
			await seedPackageBooking(t, packageId, index);
		}

		const result = await t.action(api.packageScheduling.createPackageBooking, { token, ...target });

		expect(result).toEqual([{ reason: "PACKAGE_CAPACITY_EXCEEDED" }, null]);
		expect(await readBookings(t)).toHaveLength(4);
		expect(providerFakes.insertEvent).not.toHaveBeenCalled();
	});

	test("rejects a busy time without creating a booking or Calendar event", async () => {
		const t = createConvexTest();
		const { token } = await seedPackage(t);
		providerFakes.listEvents.mockResolvedValue({
			data: {
				items: [
					{
						id: "conflicting-event",
						start: { dateTime: "2030-01-10T23:00:00.000Z" },
						end: { dateTime: "2030-01-11T00:00:00.000Z" }
					}
				]
			}
		});

		const result = await t.action(api.packageScheduling.createPackageBooking, { token, ...target });

		expect(result).toEqual([{ reason: "BOOKING_TIME_UNAVAILABLE" }, null]);
		await expectNoBookingOrCalendarEvent(t);
	});

	test("creates matching Calendar and Convex records for a valid request", async () => {
		const t = createConvexTest();
		const { packageId, token } = await seedPackage(t);

		const result = await t.action(api.packageScheduling.createPackageBooking, {
			token,
			...target,
			notes: "Use the side entrance",
			remotePodcast: true
		});
		const bookings = await readBookings(t);

		expect(bookings).toHaveLength(1);
		expect(bookings[0]).toMatchObject({
			name: "Test customer",
			phone: "0400000000",
			accountName: "Test account",
			email: "customer@example.com",
			date: target.date,
			time: target.time,
			duration: "1h",
			service: "Table Setup",
			addons: ["Live Streaming", "Remote Podcast"],
			notes: "Use the side entrance",
			status: "confirmed",
			googleCalendarId: "primary-calendar",
			googleEventId: "google-event-1",
			multiBookingPackageId: packageId
		});
		expect(result).toEqual([null, { bookingId: bookings[0]?._id }]);
		expect(providerFakes.insertEvent).toHaveBeenCalledTimes(1);
		expect(providerFakes.deleteEvent).not.toHaveBeenCalled();
	});

	test("allows one winner when two requests race for the final package slot", async () => {
		const t = createConvexTest();
		const { packageId, token } = await seedPackage(t);
		for (let index = 0; index < 3; index += 1) {
			await seedPackageBooking(t, packageId, index);
		}
		let nextEventNumber = 0;
		providerFakes.insertEvent.mockImplementation(async () => {
			nextEventNumber += 1;
			return { data: { id: `google-event-${nextEventNumber}` } };
		});

		const results = await Promise.all([
			t.action(api.packageScheduling.createPackageBooking, { token, ...target }),
			t.action(api.packageScheduling.createPackageBooking, { token, ...target })
		]);

		expect(results.filter(([error]) => error === null)).toHaveLength(1);
		expect(results).toContainEqual([{ reason: "PACKAGE_CAPACITY_EXCEEDED" }, null]);
		expect(await readBookings(t)).toHaveLength(4);
		expect(providerFakes.insertEvent).toHaveBeenCalledTimes(2);
		expect(providerFakes.deleteEvent).toHaveBeenCalledTimes(1);
	});

	test("deletes a created Calendar event when the booking cannot be saved", async () => {
		const t = createConvexTest();
		const { packageId, token } = await seedPackage(t);
		for (let index = 0; index < 3; index += 1) {
			await seedPackageBooking(t, packageId, index);
		}
		let releaseCalendarCreation: (() => void) | undefined;
		const calendarCreationBlocked = new Promise<void>((resolve) => {
			releaseCalendarCreation = resolve;
		});
		let notifyCalendarCreationStarted: (() => void) | undefined;
		const calendarCreationStarted = new Promise<void>((resolve) => {
			notifyCalendarCreationStarted = resolve;
		});
		providerFakes.insertEvent.mockImplementation(async () => {
			notifyCalendarCreationStarted?.();
			await calendarCreationBlocked;
			return { data: { id: "orphaned-event" } };
		});

		const schedulingRequest = t.action(api.packageScheduling.createPackageBooking, {
			token,
			...target
		});
		await calendarCreationStarted;
		await seedPackageBooking(t, packageId, 3);
		releaseCalendarCreation?.();
		const result = await schedulingRequest;

		expect(result).toEqual([{ reason: "PACKAGE_CAPACITY_EXCEEDED" }, null]);
		expect(await readBookings(t)).toHaveLength(4);
		expect(providerFakes.insertEvent).toHaveBeenCalledTimes(1);
		expect(providerFakes.deleteEvent).toHaveBeenCalledTimes(1);
		expect(providerFakes.deleteEvent).toHaveBeenCalledWith({
			calendarId: "primary-calendar",
			eventId: "orphaned-event",
			sendUpdates: "all"
		});
	});
});

async function seedPackage(t: TestClient, overrides: { expiresAt?: number } = {}) {
	const token = "package-scheduling-token";
	const scheduleTokenHash = await hashRescheduleToken(token);
	const packageId = await t.run((ctx) =>
		ctx.db.insert("multiBookingPackages", {
			name: "Test customer",
			phone: "0400000000",
			accountName: "Test account",
			email: "customer@example.com",
			duration: "1h",
			addons: ["Live Streaming"],
			packageSize: 4,
			singleSessionAmount: 100,
			packageSubtotalAmount: 400,
			discountPercent: 10,
			discountAmount: 40,
			totalDueAmount: 360,
			status: "paid",
			createdAt: now - 1_000,
			invoiceDueAt: now - 500,
			paidAt: now - 100,
			expiresAt: overrides.expiresAt ?? Date.parse("2030-01-20T00:00:00.000Z"),
			invoiceEmailStatus: "sent",
			scheduleTokenHash,
			scheduleLinkStatus: "active"
		})
	);

	return { packageId, token };
}

async function seedPackageBooking(
	t: TestClient,
	packageId: Id<"multiBookingPackages">,
	index: number
) {
	await t.run((ctx) =>
		ctx.db.insert("bookings", {
			name: "Test customer",
			phone: "0400000000",
			accountName: "Test account",
			email: "customer@example.com",
			date: `2030-01-${String(index + 2).padStart(2, "0")}`,
			time: "10:00",
			sessionStartAt: now + (index + 1) * 86_400_000,
			duration: "1h",
			service: "Table Setup",
			addons: [],
			status: "confirmed",
			pendingPaymentCreatedAt: now - 1_000,
			multiBookingPackageId: packageId
		})
	);
}

async function readBookings(t: TestClient) {
	return await t.run((ctx) => ctx.db.query("bookings").collect());
}

async function expectNoBookingOrCalendarEvent(t: TestClient) {
	expect(await readBookings(t)).toHaveLength(0);
	expect(providerFakes.insertEvent).not.toHaveBeenCalled();
}
