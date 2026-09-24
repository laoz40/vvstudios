/**
 * Session calendar timing, studio rules, and busy-window slot checks.
 *
 * 1. Studio availability settings
 *    Rejects dates outside the bookable window, closed days, and sessions that violate lead time or hours.
 *
 * 2. Busy window slots
 *    Marks a time unavailable when a calendar event overlaps the session, including the event buffer.
 *
 * 3. Bookable time options
 *    Filters catalog times to only those that pass the busy-window check.
 */
import { describe, expect, test } from "vitest";
import {
	checkSessionMeetsAvailabilitySettings,
	getAvailableTimeOptions,
	isTimeSlotAvailable,
	type SessionAvailabilitySettings
} from "#convex/lib/sessionCalendarTime";

const timeZone = "Australia/Sydney";

const bookingDate = "2030-01-10";

const sessionStartIso = "2030-01-09T23:00:00.000Z";

const sessionEndIso = "2030-01-10T00:00:00.000Z";

const openWeekSchedule = Array.from({ length: 7 }, () => ({
	startTime: "08:00",
	endTime: "22:00"
}));

const baseSettings: SessionAvailabilitySettings = {
	eventBufferMinutes: 30,
	leadTimeMinutes: 60,
	maxDaysAhead: 60,
	weekSchedule: openWeekSchedule
};

const nowBeforeBooking = Date.parse("2030-01-01T00:00:00.000Z");

describe("checkSessionMeetsAvailabilitySettings", () => {
	test("accepts a session inside opening hours with enough lead time", () => {
		const result = checkSessionMeetsAvailabilitySettings({
			date: bookingDate,
			time: "10:00",
			duration: "1h",
			settings: baseSettings,
			timeZone,
			now: nowBeforeBooking
		});

		expect(result.isOk()).toBe(true);
	});

	test("rejects a session that ends after closing time", () => {
		const result = checkSessionMeetsAvailabilitySettings({
			date: bookingDate,
			time: "21:30",
			duration: "2h",
			settings: baseSettings,
			timeZone,
			now: nowBeforeBooking
		});

		expect(result.isErr()).toBe(true);

		if (result.isErr()) {
			expect(result.error).toEqual({ reason: "BOOKING_OUTSIDE_OPENING_HOURS" });
		}
	});

	test("rejects a booking date beyond maxDaysAhead", () => {
		const result = checkSessionMeetsAvailabilitySettings({
			date: "2030-04-01",
			time: "10:00",
			duration: "1h",
			settings: baseSettings,
			timeZone,
			now: nowBeforeBooking
		});

		expect(result.isErr()).toBe(true);

		if (result.isErr()) {
			expect(result.error).toEqual({ reason: "BOOKING_TOO_FAR_AHEAD" });
		}
	});

	test("rejects a session inside the lead-time window", () => {
		const result = checkSessionMeetsAvailabilitySettings({
			date: bookingDate,
			time: "10:00",
			duration: "1h",
			settings: baseSettings,
			timeZone,
			now: Date.parse("2030-01-09T23:30:00.000Z")
		});

		expect(result.isErr()).toBe(true);

		if (result.isErr()) {
			expect(result.error).toEqual({ reason: "BOOKING_TOO_SOON" });
		}
	});
});

describe("isTimeSlotAvailable", () => {
	test("allows a slot with no overlapping busy windows", () => {
		expect(
			isTimeSlotAvailable({
				busyWindows: [],
				date: bookingDate,
				time: "10:00",
				duration: "1h",
				eventBufferMinutes: 30,
				timeZone
			})
		).toBe(true);
	});

	test("blocks a slot that overlaps a calendar event", () => {
		expect(
			isTimeSlotAvailable({
				busyWindows: [{ start: sessionStartIso, end: sessionEndIso }],
				date: bookingDate,
				time: "10:00",
				duration: "1h",
				eventBufferMinutes: 0,
				timeZone
			})
		).toBe(false);
	});

	test("blocks a slot separated only by the event buffer", () => {
		const laterBusyStart = "2030-01-10T00:00:00.000Z";

		const laterBusyEnd = "2030-01-10T01:00:00.000Z";

		expect(
			isTimeSlotAvailable({
				busyWindows: [{ start: laterBusyStart, end: laterBusyEnd }],
				date: bookingDate,
				time: "10:00",
				duration: "1h",
				eventBufferMinutes: 30,
				timeZone
			})
		).toBe(false);
	});

	test("allows a slot when the next event leaves enough buffer gap", () => {
		const laterBusyStart = "2030-01-10T01:00:00.000Z";

		const laterBusyEnd = "2030-01-10T02:00:00.000Z";

		expect(
			isTimeSlotAvailable({
				busyWindows: [{ start: laterBusyStart, end: laterBusyEnd }],
				date: bookingDate,
				time: "10:00",
				duration: "1h",
				eventBufferMinutes: 30,
				timeZone
			})
		).toBe(true);
	});
});

describe("getAvailableTimeOptions", () => {
	test("includes 10:00 when the slot is free and omits it when blocked", () => {
		const freeOptions = getAvailableTimeOptions({
			busyWindows: [],
			date: bookingDate,
			duration: "1h",
			eventBufferMinutes: 0,
			timeZone
		});

		const blockedOptions = getAvailableTimeOptions({
			busyWindows: [{ start: sessionStartIso, end: sessionEndIso }],
			date: bookingDate,
			duration: "1h",
			eventBufferMinutes: 0,
			timeZone
		});

		expect(freeOptions).toContain("10:00");
		expect(blockedOptions).not.toContain("10:00");
	});
});
