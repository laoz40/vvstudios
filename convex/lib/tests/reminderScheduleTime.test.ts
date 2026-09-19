/**
 * Pure timezone math for reminder batch windows.
 *
 * 1. getUtcTimeForTimeZoneDate
 *    Maps a calendar date and hour in a time zone to the matching UTC timestamp.
 *
 * 2. getTimeZoneDayRange
 *    Returns UTC bounds for a calendar day in a time zone, including day offsets.
 *
 * 3. getTomorrowTimeZoneDayRange
 *    Returns the next calendar day's UTC bounds in a time zone.
 */
import { describe, expect, test } from "vitest";
import {
	getTimeZoneDayRange,
	getTomorrowTimeZoneDayRange,
	getUtcTimeForTimeZoneDate,
	REMINDER_TIME_ZONE
} from "#convex/lib/reminderScheduleTime";

const summerNow = Date.parse("2030-01-01T23:00:00.000Z");

const winterNow = Date.parse("2030-07-15T12:00:00.000Z");

describe("getUtcTimeForTimeZoneDate", () => {
	test("maps a summer morning in Sydney to UTC during AEDT", () => {
		const utcTime = getUtcTimeForTimeZoneDate(
			{ year: 2030, month: 1, day: 3, hour: 9 },
			REMINDER_TIME_ZONE
		);

		expect(utcTime).toBe(Date.parse("2030-01-02T22:00:00.000Z"));
	});

	test("maps a winter morning in Sydney to UTC during AEST", () => {
		const utcTime = getUtcTimeForTimeZoneDate(
			{ year: 2030, month: 7, day: 15, hour: 9 },
			REMINDER_TIME_ZONE
		);

		expect(utcTime).toBe(Date.parse("2030-07-14T23:00:00.000Z"));
	});
});

describe("getTimeZoneDayRange", () => {
	test("returns the current Sydney calendar day during summer", () => {
		const { dayEnd, dayStart } = getTimeZoneDayRange(new Date(summerNow), REMINDER_TIME_ZONE);

		expect(dayStart).toBe(Date.parse("2030-01-01T13:00:00.000Z"));
		expect(dayEnd).toBe(Date.parse("2030-01-02T13:00:00.000Z"));
	});

	test("returns the current Sydney calendar day during winter", () => {
		const { dayEnd, dayStart } = getTimeZoneDayRange(new Date(winterNow), REMINDER_TIME_ZONE);

		expect(dayStart).toBe(Date.parse("2030-07-14T14:00:00.000Z"));
		expect(dayEnd).toBe(Date.parse("2030-07-15T14:00:00.000Z"));
	});

	test("shifts the target day with a positive offset", () => {
		const { dayEnd, dayStart } = getTimeZoneDayRange(new Date(summerNow), REMINDER_TIME_ZONE, 2);

		expect(dayStart).toBe(Date.parse("2030-01-03T13:00:00.000Z"));
		expect(dayEnd).toBe(Date.parse("2030-01-04T13:00:00.000Z"));
	});
});

describe("getTomorrowTimeZoneDayRange", () => {
	test("returns the next Sydney calendar day during summer", () => {
		const { dayEnd, dayStart } = getTomorrowTimeZoneDayRange(
			new Date(summerNow),
			REMINDER_TIME_ZONE
		);

		expect(dayStart).toBe(Date.parse("2030-01-02T13:00:00.000Z"));
		expect(dayEnd).toBe(Date.parse("2030-01-03T13:00:00.000Z"));
	});
});
