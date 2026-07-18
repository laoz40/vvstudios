/**
 * These tests cover moving an existing customer booking with a reschedule link.
 * They verify that Calendar, booking, reminder, link, and email state change together.
 *
 * 1. Invalid or busy target
 *    A time rejected by backend availability checks must leave the original booking,
 *    Calendar event, reminder state, and reschedule link untouched.
 *
 * 2. Successful reschedule
 *    A valid move must update Google Calendar and Convex, clear old reminder state,
 *    keep the submitted link active for future moves, and send one update email.
 *
 * 3. Concurrent token use
 *    Two requests using the same token at the same time must have one winner and create
 *    at most one Calendar update and email while leaving the link reusable afterward.
 *
 * 4. Calendar update failure
 *    A provider failure after the token is claimed must reactivate that token so the
 *    customer can retry, while leaving the booking and reminder state unchanged.
 *
 * Google Calendar and email are replaced with fakes, so no real requests are made.
 */
import { beforeEach, describe, expect, test, vi } from "vitest";
import { api, internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import { createConvexTest } from "../test.setup";

const providerFakes = vi.hoisted(() => ({
	getEvent: vi.fn(),
	insertEvent: vi.fn(),
	listEvents: vi.fn(),
	patchEvent: vi.fn(),
	sendInvoiceEmails: vi.fn()
}));

vi.mock("../env", () => ({
	env: { STRIPE_CHECKOUT_RETURN_URL: "https://example.com/checkout/return" }
}));

vi.mock("../lib/googleCalendarClient", () => ({
	getGoogleCalendarClient: () => ({
		calendarId: "primary-calendar",
		calendarIds: ["primary-calendar"],
		timeZone: "Australia/Sydney",
		calendar: {
			events: {
				get: providerFakes.getEvent,
				insert: providerFakes.insertEvent,
				list: providerFakes.listEvents,
				patch: providerFakes.patchEvent
			}
		}
	})
}));

vi.mock("../lib/email", () => ({
	sendBookingInvoiceEmailsForBooking: providerFakes.sendInvoiceEmails
}));

vi.mock("../lib/rateLimits", () => ({
	checkBookingSubmitRateLimit: vi.fn().mockResolvedValue([null, { allowed: true }]),
	checkGoogleCalendarAvailabilityRateLimit: vi.fn().mockResolvedValue([null, { allowed: true }])
}));

const now = Date.parse("2030-01-01T00:00:00.000Z");
const originalSessionStartAt = Date.parse("2030-01-09T23:00:00.000Z");
const targetSessionStartAt = Date.parse("2030-01-10T23:00:00.000Z");
const target = { date: "2030-01-11", time: "10:00" };

type TestClient = ReturnType<typeof createConvexTest>;

beforeEach(() => {
	vi.clearAllMocks();
	vi.spyOn(Date, "now").mockReturnValue(now);
	providerFakes.getEvent.mockResolvedValue({ data: { status: "confirmed" } });
	providerFakes.insertEvent.mockResolvedValue({ data: { id: "replacement-event" } });
	providerFakes.listEvents.mockResolvedValue({ data: { items: [] } });
	providerFakes.patchEvent.mockResolvedValue({ data: {} });
	providerFakes.sendInvoiceEmails.mockResolvedValue([null, { sent: true }]);
});

describe("customer booking rescheduling", () => {
	test("leaves the original booking and link untouched when the target is busy", async () => {
		const t = createConvexTest();
		const { bookingId, linkId, token } = await seedReschedulableBooking(t);
		const bookingBefore = await readBooking(t, bookingId);
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

		const result = await t.action(api.googleCalendar.rescheduleBooking, { token, ...target });

		expect(result).toEqual([{ reason: "BOOKING_TIME_UNAVAILABLE" }, null]);
		expect(await readBooking(t, bookingId)).toEqual(bookingBefore);
		expect(await readLink(t, linkId)).toMatchObject({ status: "active" });
		expect(await readLinks(t, bookingId)).toHaveLength(1);
		expect(providerFakes.getEvent).not.toHaveBeenCalled();
		expect(providerFakes.patchEvent).not.toHaveBeenCalled();
		expect(providerFakes.sendInvoiceEmails).not.toHaveBeenCalled();
	});

	test("moves the Calendar event and all related booking state once", async () => {
		const t = createConvexTest();
		const { bookingId, linkId, token } = await seedReschedulableBooking(t);

		const result = await t.action(api.googleCalendar.rescheduleBooking, { token, ...target });
		const booking = await readBooking(t, bookingId);
		const links = await readLinks(t, bookingId);

		expect(result).toEqual([null, { bookingId }]);
		expect(booking).toMatchObject({
			date: target.date,
			time: target.time,
			sessionStartAt: targetSessionStartAt
		});
		expect(booking?.reminderEmailClaimedAt).toBeUndefined();
		expect(booking?.reminderEmailSentAt).toBeUndefined();
		expect(booking?.reminderEmailFailureCode).toBeUndefined();
		expect(links).toHaveLength(1);
		expect(links.find((link) => link._id === linkId)).toMatchObject({
			status: "active",
			expiresAt: targetSessionStartAt
		});
		expect(links.filter((link) => link.status === "active")).toHaveLength(1);
		expect(providerFakes.patchEvent).toHaveBeenCalledTimes(1);
		expect(providerFakes.sendInvoiceEmails).toHaveBeenCalledTimes(1);
	});

	test("reactivates the token when the Calendar update fails", async () => {
		const t = createConvexTest();
		const { bookingId, linkId, token } = await seedReschedulableBooking(t);
		const bookingBefore = await readBooking(t, bookingId);
		providerFakes.patchEvent.mockRejectedValue(new Error("Calendar unavailable"));

		const result = await t.action(api.googleCalendar.rescheduleBooking, { token, ...target });

		expect(result).toEqual([{ reason: "GOOGLE_CALENDAR_UPDATE_FAILED" }, null]);
		expect(await readBooking(t, bookingId)).toEqual(bookingBefore);
		expect(await readLink(t, linkId)).toMatchObject({ status: "active" });
		expect((await readLink(t, linkId))?.usedAt).toBeUndefined();
		expect(await readLinks(t, bookingId)).toHaveLength(1);
		expect(providerFakes.sendInvoiceEmails).not.toHaveBeenCalled();
	});

	test("allows only one concurrent reschedule with the same token", async () => {
		const t = createConvexTest();
		const { bookingId, token } = await seedReschedulableBooking(t);
		let availabilityChecks = 0;
		let releaseChecks: (() => void) | undefined;
		const bothChecking = new Promise<void>((resolve) => {
			releaseChecks = resolve;
		});
		providerFakes.listEvents.mockImplementation(async () => {
			availabilityChecks += 1;
			if (availabilityChecks === 2) releaseChecks?.();
			await bothChecking;
			return { data: { items: [] } };
		});

		const results = await Promise.all([
			t.action(api.googleCalendar.rescheduleBooking, { token, ...target }),
			t.action(api.googleCalendar.rescheduleBooking, { token, ...target })
		]);
		const links = await readLinks(t, bookingId);

		expect(results.filter(([error]) => error === null)).toHaveLength(1);
		expect(results).toContainEqual([{ reason: "RESCHEDULE_LINK_USED" }, null]);
		expect(links.filter((link) => link.status === "active")).toHaveLength(1);
		expect(providerFakes.patchEvent).toHaveBeenCalledTimes(1);
		expect(providerFakes.sendInvoiceEmails).toHaveBeenCalledTimes(1);
	});
});

async function seedReschedulableBooking(t: TestClient) {
	const bookingId = await t.run(async (ctx) => {
		await ctx.db.insert("bookingSettings", {
			key: "main",
			leadTimeMinutes: 60,
			eventBufferMinutes: 15,
			maxDaysAhead: 30,
			weekSchedule: Array.from({ length: 7 }, () => ({ startTime: "09:00", endTime: "17:00" })),
			updatedAt: now
		});
		return await ctx.db.insert("bookings", {
			name: "Test customer",
			phone: "0400000000",
			accountName: "Test account",
			email: "customer@example.com",
			date: "2030-01-10",
			time: "10:00",
			sessionStartAt: originalSessionStartAt,
			duration: "1h",
			service: "Remote Podcast",
			addons: [],
			status: "confirmed",
			pendingPaymentCreatedAt: now,
			googleCalendarId: "primary-calendar",
			googleEventId: "original-event",
			reminderEmailClaimedAt: now - 3,
			reminderEmailSentAt: now - 2,
			reminderEmailFailureCode: "SEND_FAILED"
		});
	});
	const linkResult = await t.mutation(
		internal.bookingReschedule.createActiveRescheduleLinkInternal,
		{ bookingId, expiresAt: originalSessionStartAt, now }
	);
	if (linkResult[0] !== null) throw new Error("Failed to seed reschedule link");

	return { bookingId, linkId: linkResult[1].linkId, token: linkResult[1].token };
}

async function readBooking(t: TestClient, bookingId: Id<"bookings">) {
	return await t.run((ctx) => ctx.db.get(bookingId));
}

async function readLink(t: TestClient, linkId: Id<"bookingRescheduleLinks">) {
	return await t.run((ctx) => ctx.db.get(linkId));
}

async function readLinks(t: TestClient, bookingId: Id<"bookings">) {
	return await t.run((ctx) =>
		ctx.db
			.query("bookingRescheduleLinks")
			.withIndex("by_bookingId_and_status", (query) => query.eq("bookingId", bookingId))
			.collect()
	);
}
