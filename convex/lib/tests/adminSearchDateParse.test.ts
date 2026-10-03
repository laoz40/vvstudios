/**
 * Admin date search value parsing.
 *
 * 1. ISO and AU day
 *    Single-day ranges in Australia/Sydney for yyyy-mm-dd and d/m/y.
 *
 * 2. Month ranges
 *    Whole months from yyyy-mm, m/yyyy, and month names.
 *
 * 3. Relative days
 *    today, tomorrow, and yesterday from a fixed anchor instant.
 */
import { describe, expect, test } from "vitest";
import { parseAdminSearchDateValue } from "#convex/lib/adminSearch/adminSearchDateParse";
import { REMINDER_TIME_ZONE } from "#convex/lib/reminderScheduleTime";

const sydneyTimeZone = REMINDER_TIME_ZONE;

const summerAnchor = new Date("2030-01-01T12:00:00.000Z");

describe("parseAdminSearchDateValue", () => {
	test("ISO single day", () => {
		const range = parseAdminSearchDateValue("2030-01-15", {
			now: summerAnchor,
			timeZone: sydneyTimeZone
		});

		expect(range).toEqual({
			rangeStart: Date.parse("2030-01-14T13:00:00.000Z"),
			rangeEnd: Date.parse("2030-01-15T13:00:00.000Z")
		});
	});

	test("AU day month year", () => {
		const range = parseAdminSearchDateValue("15/1/2030", {
			now: summerAnchor,
			timeZone: sydneyTimeZone
		});

		expect(range).toEqual({
			rangeStart: Date.parse("2030-01-14T13:00:00.000Z"),
			rangeEnd: Date.parse("2030-01-15T13:00:00.000Z")
		});
	});

	test("ISO year month", () => {
		const range = parseAdminSearchDateValue("2030-01", {
			now: summerAnchor,
			timeZone: sydneyTimeZone
		});

		expect(range).toEqual({
			rangeStart: Date.parse("2029-12-31T13:00:00.000Z"),
			rangeEnd: Date.parse("2030-01-31T13:00:00.000Z")
		});
	});

	test("AU month year", () => {
		const range = parseAdminSearchDateValue("1/2030", {
			now: summerAnchor,
			timeZone: sydneyTimeZone
		});

		expect(range).toEqual({
			rangeStart: Date.parse("2029-12-31T13:00:00.000Z"),
			rangeEnd: Date.parse("2030-01-31T13:00:00.000Z")
		});
	});

	test("month name with year", () => {
		const range = parseAdminSearchDateValue("March 2030", {
			now: summerAnchor,
			timeZone: sydneyTimeZone
		});

		expect(range).toEqual({
			rangeStart: Date.parse("2030-02-28T13:00:00.000Z"),
			rangeEnd: Date.parse("2030-03-31T13:00:00.000Z")
		});
	});

	test("month name without year uses anchor year in time zone", () => {
		const range = parseAdminSearchDateValue("january", {
			now: summerAnchor,
			timeZone: sydneyTimeZone
		});

		expect(range).toEqual({
			rangeStart: Date.parse("2029-12-31T13:00:00.000Z"),
			rangeEnd: Date.parse("2030-01-31T13:00:00.000Z")
		});
	});

	test("today from anchor", () => {
		const range = parseAdminSearchDateValue("today", {
			now: summerAnchor,
			timeZone: sydneyTimeZone
		});

		expect(range).toEqual({
			rangeStart: Date.parse("2029-12-31T13:00:00.000Z"),
			rangeEnd: Date.parse("2030-01-01T13:00:00.000Z")
		});
	});

	test("invalid calendar date", () => {
		expect(
			parseAdminSearchDateValue("31/2/2030", { now: summerAnchor, timeZone: sydneyTimeZone })
		).toBeNull();
	});
});
