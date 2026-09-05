/**
 * These tests cover reading and creating package sessions from a customer scheduling link.
 * They verify that the public read path enforces every package lifecycle state, invalid create
 * requests have no side effects, successful requests keep Convex and Google Calendar in sync,
 * and partial failures are compensated.
 *
 * 1. Public scheduling-link access
 *    Unknown, unpaid, disabled, and expired links cannot read package scheduling data.
 *
 * 2. Invalid scheduling token
 *    An unknown token cannot select a package or create any records. The token
 *    is a random secret whose hash is stored on the package; it is not a package ID.
 *
 * 3. Expired package
 *    A package cannot schedule another session at or after its expiry time.
 *
 * 4. Package capacity
 *    A package with all purchased sessions already scheduled cannot add another.
 *
 * 5. Unavailable time
 *    A time that overlaps an existing Calendar event cannot create a booking or
 *    another Calendar event.
 *
 * 6. Successful scheduling
 *    One matching Calendar event and confirmed Convex booking are created with
 *    the package snapshot, session choices, package link, and Calendar IDs. Both
 *    sessions of the same package email share one Drive client record created
 *    without folders yet, and schedule Drive setup for session end instead of
 *    creating folders during booking.
 *
 * 7. Concurrent final-slot requests
 *    When two requests race for the last package session, only one booking wins
 *    and the Calendar event created by the losing request is deleted.
 *
 * 8. Cleanup when saving fails
 *    Tests two requests competing for the final package slot. The request that
 *    saves its Convex booking first keeps its Calendar event. The losing request,
 *    which already created a Calendar event, deletes its own event.
 *
 * 9. Moving a package session
 *    A customer cannot move another package's session, a locked session, or move
 *    to a busy time. A valid move updates the booking and Calendar event together.
 *
 * 10. Cancelling a package session
 *    The booking is cancelled only after its Calendar event is deleted. Cancelling
 *    the session also frees a package slot so the customer can book another session.
 *
 * Google Calendar and rate limits are replaced with fakes, so no real provider
 * requests are made and these tests exercise only package scheduling behavior.
 */
import { beforeEach, describe, expect, test, vi } from "vitest";
import { ok } from "neverthrow";
import { api } from "#convex/_generated/api";
import type { Id } from "#convex/_generated/dataModel";
import { hashRescheduleToken } from "#convex/lib/sessionRescheduleLinks";
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

vi.mock("#convex/lib/rateLimits", () => ({
	checkBookingSubmitRateLimit: vi.fn(() => ok(null)),
	checkGoogleCalendarAvailabilityRateLimit: vi.fn(() => ok({ allowed: true }))
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
	providerFakes.getEvent.mockResolvedValue({ data: { status: "confirmed" } });
	providerFakes.insertEvent.mockResolvedValue({ data: { id: "google-event-1" } });
	providerFakes.listEvents.mockResolvedValue({ data: { items: [] } });
	providerFakes.patchEvent.mockResolvedValue({ data: {} });
});

describe("package scheduling link access", () => {
	test.each([
		{ name: "unknown", seed: false, overrides: {}, expectedReason: "PACKAGE_LINK_INVALID" },
		{
			name: "unpaid",
			seed: true,
			overrides: { status: "pending_payment" as const },
			expectedReason: "PACKAGE_NOT_PAID"
		},
		{
			name: "disabled",
			seed: true,
			overrides: { scheduleLinkStatus: "disabled" as const },
			expectedReason: "PACKAGE_LINK_INACTIVE"
		},
		{
			name: "expired",
			seed: true,
			overrides: { expiresAt: now },
			expectedReason: "PACKAGE_LINK_EXPIRED"
		}
	])("rejects a $name token on the public read path", async (testCase) => {
		const t = createConvexTest();
		const seededPackage = testCase.seed ? await seedPackage(t, testCase.overrides) : null;

		const result = await t.query(api.packageScheduling.getPackageByToken, {
			token: seededPackage?.token ?? "unknown-token"
		});

		expect(result).toEqual([{ reason: testCase.expectedReason }, null]);
	});
});

describe("package Calendar availability", () => {
	// Verifies an invalid package token stops before any Google Calendar request.
	test("rejects an invalid token before loading Calendar availability", async () => {
		const t = createConvexTest();

		const result = await t.action(api.packageSchedulingCalendar.getPackageBusyWindows, {
			rateLimitKey: "invalid-package",
			token: "unknown-token"
		});

		expect(result).toEqual([{ reason: "PACKAGE_LINK_INVALID" }, null]);
		expect(providerFakes.listEvents).not.toHaveBeenCalled();
	});

	// Verifies package availability returns the package expiry, timezone, and grouped provider data.
	test("loads Calendar availability through the package expiry date", async () => {
		const t = createConvexTest();
		const { token } = await seedPackage(t);

		const result = await t.action(api.packageSchedulingCalendar.getPackageBusyWindows, {
			rateLimitKey: "valid-package",
			token
		});

		expect(result).toEqual([
			null,
			{
				busyWindowsByMonth: {},
				packageExpiresAt: Date.parse("2030-01-20T00:00:00.000Z"),
				timeZone: "Australia/Sydney"
			}
		]);
		expect(providerFakes.listEvents).toHaveBeenCalledTimes(1);
	});
});

describe("package session creation validation", () => {
	test("rejects an invalid token without creating records", async () => {
		const t = createConvexTest();

		const result = await t.action(api.packageScheduling.createPackageSession, {
			token: "unknown-token",
			...target
		});

		expect(result).toEqual([{ reason: "PACKAGE_LINK_INVALID" }, null]);
		await expectNoBookingOrCalendarEvent(t);
	});

	test("rejects an expired package without creating records", async () => {
		const t = createConvexTest();
		const { token } = await seedPackage(t, { expiresAt: now });

		const result = await t.action(api.packageScheduling.createPackageSession, { token, ...target });

		expect(result).toEqual([{ reason: "PACKAGE_LINK_EXPIRED" }, null]);
		await expectNoBookingOrCalendarEvent(t);
	});

	test("rejects a package with every session scheduled without creating another record", async () => {
		const t = createConvexTest();
		const { packageId, token } = await seedPackage(t);
		for (let index = 0; index < 4; index += 1) {
			await seedPackageSession(t, packageId, index);
		}

		const result = await t.action(api.packageScheduling.createPackageSession, { token, ...target });

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

		const result = await t.action(api.packageScheduling.createPackageSession, { token, ...target });

		expect(result).toEqual([{ reason: "BOOKING_TIME_UNAVAILABLE" }, null]);
		await expectNoBookingOrCalendarEvent(t);
	});

	test("creates matching Calendar and Convex records for a valid request", async () => {
		const t = createConvexTest();
		const { packageId, token } = await seedPackage(t);

		const result = await t.action(api.packageScheduling.createPackageSession, {
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

	test("links one Drive client record across sessions and defers folder setup", async () => {
		const t = createConvexTest();
		const { token } = await seedPackage(t);

		const firstResult = await t.action(api.packageScheduling.createPackageSession, {
			token,
			...target
		});
		const secondResult = await t.action(api.packageScheduling.createPackageSession, {
			token,
			...target
		});
		const bookings = await readBookings(t);
		const driveClients = await t.run((ctx) => ctx.db.query("driveClients").collect());
		const driveSessions = await t.run((ctx) => ctx.db.query("driveSessions").collect());

		expect(firstResult[0]).toBeNull();
		expect(secondResult[0]).toBeNull();
		expect(bookings).toHaveLength(2);
		expect(bookings[0]?.driveClientId).toBeDefined();
		expect(bookings[1]?.driveClientId).toEqual(bookings[0]?.driveClientId);
		// Booking creates the client record and schedules setup; folders appear after session end.
		expect(driveClients).toHaveLength(1);
		expect(driveClients[0]).toMatchObject({ normalizedEmail: "customer@example.com" });
		expect(driveClients[0]?.folderId).toBeUndefined();
		expect(driveClients[0]?.folderUrl).toBeUndefined();
		expect(driveSessions).toHaveLength(0);
	});

	test("allows one winner when two requests race for the final package slot", async () => {
		const t = createConvexTest();
		const { packageId, token } = await seedPackage(t);
		for (let index = 0; index < 3; index += 1) {
			await seedPackageSession(t, packageId, index);
		}
		let nextEventNumber = 0;
		providerFakes.insertEvent.mockImplementation(async () => {
			nextEventNumber += 1;
			return { data: { id: `google-event-${nextEventNumber}` } };
		});

		const results = await Promise.all([
			t.action(api.packageScheduling.createPackageSession, { token, ...target }),
			t.action(api.packageScheduling.createPackageSession, { token, ...target })
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
			await seedPackageSession(t, packageId, index);
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

		const schedulingRequest = t.action(api.packageScheduling.createPackageSession, {
			token,
			...target
		});
		await calendarCreationStarted;
		await seedPackageSession(t, packageId, 3);
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

describe("package session rescheduling", () => {
	test("rejects another package's booking and a locked booking without side effects", async () => {
		const t = createConvexTest();
		const owner = await seedPackage(t);
		const other = await seedPackage(t, {}, "other-package-token");
		const bookingId = await seedPackageSession(t, owner.packageId, 0);

		const wrongOwnerResult = await t.action(api.packageScheduling.reschedulePackageSession, {
			bookingId,
			token: other.token,
			...target
		});
		await t.run((ctx) => ctx.db.patch(bookingId, { sessionStartAt: now + 30 * 60_000 }));
		const lockedResult = await t.action(api.packageScheduling.reschedulePackageSession, {
			bookingId,
			token: owner.token,
			...target
		});

		expect(wrongOwnerResult).toEqual([{ reason: "PACKAGE_BOOKING_NOT_FOUND" }, null]);
		expect(lockedResult).toEqual([{ reason: "PACKAGE_BOOKING_LOCKED" }, null]);
		expect(providerFakes.patchEvent).not.toHaveBeenCalled();
	});

	test("preserves the original booking and event when the target is busy", async () => {
		const t = createConvexTest();
		const { packageId, token } = await seedPackage(t);
		const bookingId = await seedPackageSession(t, packageId, 0);
		const original = await t.run((ctx) => ctx.db.get(bookingId));
		providerFakes.listEvents.mockResolvedValue({
			data: {
				items: [
					{
						id: "busy",
						start: { dateTime: "2030-01-10T23:00:00.000Z" },
						end: { dateTime: "2030-01-11T00:00:00.000Z" }
					}
				]
			}
		});

		const result = await t.action(api.packageScheduling.reschedulePackageSession, {
			bookingId,
			token,
			...target
		});

		expect(result).toEqual([{ reason: "BOOKING_TIME_UNAVAILABLE" }, null]);
		expect(await t.run((ctx) => ctx.db.get(bookingId))).toEqual(original);
		expect(providerFakes.patchEvent).not.toHaveBeenCalled();
	});

	test("moves Calendar and Convex together, resets reminders, and schedules reevaluation", async () => {
		const t = createConvexTest();
		const { packageId, token } = await seedPackage(t);
		const bookingId = await seedPackageSession(t, packageId, 0);

		const result = await t.action(api.packageScheduling.reschedulePackageSession, {
			bookingId,
			token,
			...target,
			service: "Armchair Setup",
			remotePodcast: true,
			notes: "Moved session"
		});
		const state = await t.run(async (ctx) => ({
			booking: await ctx.db.get(bookingId),
			jobs: await ctx.db.system.query("_scheduled_functions").collect()
		}));

		expect(result).toEqual([null, { bookingId }]);
		expect(state.booking).toMatchObject({
			date: target.date,
			time: target.time,
			service: "Armchair Setup",
			addons: ["Live Streaming", "Remote Podcast"],
			notes: "Moved session"
		});
		expect(state.booking).not.toHaveProperty("reminderEmailClaimedAt");
		expect(state.booking).not.toHaveProperty("reminderEmailSentAt");
		expect(state.booking).not.toHaveProperty("reminderEmailFailureCode");
		expect(providerFakes.patchEvent).toHaveBeenCalledTimes(1);
		expect(
			state.jobs.some((job) => job.name.includes("processPackageAdjustmentWhenSessionsComplete"))
		).toBe(true);
	});
});

describe("package session unscheduling", () => {
	test("keeps the booking active when Calendar deletion fails", async () => {
		const t = createConvexTest();
		const { packageId, token } = await seedPackage(t);
		const bookingId = await seedPackageSession(t, packageId, 0);
		providerFakes.deleteEvent.mockRejectedValue(new Error("provider unavailable"));

		const result = await t.action(api.packageScheduling.unschedulePackageSession, {
			bookingId,
			token
		});

		expect(result).toEqual([{ reason: "GOOGLE_CALENDAR_SYNC_FAILED" }, null]);
		expect(await t.run((ctx) => ctx.db.get(bookingId))).toMatchObject({ status: "confirmed" });
	});

	test("cancels when the saved Calendar event is already missing", async () => {
		const t = createConvexTest();
		const { packageId, token } = await seedPackage(t);
		const bookingId = await seedPackageSession(t, packageId, 0);
		providerFakes.deleteEvent.mockRejectedValue({ response: { status: 404 } });

		const result = await t.action(api.packageScheduling.unschedulePackageSession, {
			bookingId,
			token
		});

		expect(result).toEqual([null, { cancelled: true, bookingId }]);
		expect(await t.run((ctx) => ctx.db.get(bookingId))).toMatchObject({ status: "cancelled" });
	});

	test("cancels after deletion and frees capacity for another session", async () => {
		const t = createConvexTest();
		const { packageId, token } = await seedPackage(t);
		for (let index = 0; index < 3; index += 1) await seedPackageSession(t, packageId, index);
		const bookingId = await seedPackageSession(t, packageId, 3);

		const result = await t.action(api.packageScheduling.unschedulePackageSession, {
			bookingId,
			token
		});
		const replacement = await t.action(api.packageScheduling.createPackageSession, {
			token,
			...target
		});
		const cancelled = await t.run((ctx) => ctx.db.get(bookingId));

		expect(result).toEqual([null, { cancelled: true, bookingId }]);
		expect(cancelled).toMatchObject({ status: "cancelled" });
		expect(cancelled).not.toHaveProperty("googleCalendarId");
		expect(cancelled).not.toHaveProperty("googleEventId");
		expect(replacement[0]).toBeNull();
		expect(
			(await readBookings(t)).filter((booking) => booking.status === "confirmed")
		).toHaveLength(4);
	});
});

async function seedPackage(
	t: TestClient,
	overrides: {
		expiresAt?: number;
		scheduleLinkStatus?: "active" | "disabled";
		status?: "paid" | "pending_payment";
	} = {},
	token = "package-scheduling-token"
) {
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
			status: overrides.status ?? "paid",
			createdAt: now - 1_000,
			invoiceDueAt: now - 500,
			paidAt: now - 100,
			expiresAt: overrides.expiresAt ?? Date.parse("2030-01-20T00:00:00.000Z"),
			invoiceEmailStatus: "sent",
			scheduleTokenHash,
			scheduleLinkStatus: overrides.scheduleLinkStatus ?? "active"
		})
	);

	return { packageId, token };
}

async function seedPackageSession(
	t: TestClient,
	packageId: Id<"multiBookingPackages">,
	index: number
) {
	return await t.run((ctx) =>
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
			googleCalendarId: "primary-calendar",
			googleEventId: `existing-event-${index}`,
			reminderEmailClaimedAt: now - 900,
			reminderEmailSentAt: now - 800,
			reminderEmailFailureCode: "previous-failure",
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
