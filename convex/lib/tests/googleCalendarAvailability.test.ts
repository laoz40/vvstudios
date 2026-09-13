/**
 * Google Calendar event loading for availability checks.
 *
 * 1. getBusyWindowsInRange
 *    Turns calendar events into busy windows, skips ignored events, and merges calendars.
 *
 * 2. getBusyWindows
 *    Loads busy windows for one booking date using the buffered availability range.
 */
import type { calendar_v3 } from "googleapis/build/src/apis/calendar/v3";
import { describe, expect, test } from "vitest";
import { getBusyWindows, getBusyWindowsInRange } from "#convex/lib/googleCalendarAvailability";

const timeZone = "Australia/Sydney";

const date = "2030-01-10";

const timeMin = "2030-01-09T12:00:00.000Z";

const timeMax = "2030-01-11T12:00:00.000Z";

const blockingEvent: calendar_v3.Schema$Event = {
	id: "evt-block",
	start: { dateTime: "2030-01-10T10:00:00+11:00" },
	end: { dateTime: "2030-01-10T11:00:00+11:00" }
};

const overlappingEvent: calendar_v3.Schema$Event = {
	id: "evt-overlap",
	start: { dateTime: "2030-01-10T10:30:00+11:00" },
	end: { dateTime: "2030-01-10T11:30:00+11:00" }
};

type CalendarPage = { items: calendar_v3.Schema$Event[]; nextPageToken?: string };

function calendarWithPages(pagesByCalendarId: Record<string, CalendarPage[]>) {
	return {
		events: {
			list: async ({
				calendarId,
				pageToken
			}: {
				calendarId: string;
				pageToken?: string;
			}) => {
				const pages = pagesByCalendarId[calendarId] ?? [{ items: [] }];
				const pageIndex = pageToken ? Number(pageToken) : 0;
				const page = pages[pageIndex] ?? { items: [] };

				return {
					data: {
						items: page.items,
						nextPageToken: page.nextPageToken
					}
				};
			}
		}
	};
}

describe("getBusyWindowsInRange", () => {
	test("returns no busy windows for an empty calendar", async () => {
		const busyWindows = await getBusyWindowsInRange({
			calendar: calendarWithPages({ primary: [{ items: [] }] }),
			calendarIds: ["primary"],
			timeMax,
			timeMin,
			timeZone
		});

		expect(busyWindows).toEqual([]);
	});

	test("returns a busy window for a conflicting event in the range", async () => {
		const busyWindows = await getBusyWindowsInRange({
			calendar: calendarWithPages({ primary: [{ items: [blockingEvent] }] }),
			calendarIds: ["primary"],
			timeMax,
			timeMin,
			timeZone
		});

		expect(busyWindows).toEqual([
			{
				calendarId: "primary",
				eventId: "evt-block",
				start: blockingEvent.start?.dateTime,
				end: blockingEvent.end?.dateTime
			}
		]);
	});

	test("ignores a matching event id when rescheduling the same calendar event", async () => {
		const busyWindows = await getBusyWindowsInRange({
			calendar: calendarWithPages({ primary: [{ items: [blockingEvent] }] }),
			calendarIds: ["primary"],
			ignoredEvent: { calendarId: "primary", eventId: "evt-block" },
			timeMax,
			timeMin,
			timeZone
		});

		expect(busyWindows).toEqual([]);
	});

	test("still returns an ignored event id from another calendar", async () => {
		const busyWindows = await getBusyWindowsInRange({
			calendar: calendarWithPages({
				"room-a": [{ items: [blockingEvent] }],
				"room-b": [{ items: [{ ...blockingEvent, id: "evt-block" }] }]
			}),
			calendarIds: ["room-a", "room-b"],
			ignoredEvent: { calendarId: "room-a", eventId: "evt-block" },
			timeMax,
			timeMin,
			timeZone
		});

		expect(busyWindows).toEqual([
			{
				calendarId: "room-b",
				eventId: "evt-block",
				start: blockingEvent.start?.dateTime,
				end: blockingEvent.end?.dateTime
			}
		]);
	});

	test("merges overlapping events from multiple calendars", async () => {
		const busyWindows = await getBusyWindowsInRange({
			calendar: calendarWithPages({
				"room-a": [{ items: [blockingEvent] }],
				"room-b": [{ items: [overlappingEvent] }]
			}),
			calendarIds: ["room-a", "room-b"],
			timeMax,
			timeMin,
			timeZone
		});

		expect(busyWindows).toEqual([
			{
				calendarId: "room-a",
				eventId: "evt-block",
				start: blockingEvent.start?.dateTime,
				end: blockingEvent.end?.dateTime
			},
			{
				calendarId: "room-b",
				eventId: "evt-overlap",
				start: overlappingEvent.start?.dateTime,
				end: overlappingEvent.end?.dateTime
			}
		]);
	});

	test("merges paged results from one calendar", async () => {
		const busyWindows = await getBusyWindowsInRange({
			calendar: calendarWithPages({
				primary: [
					{ items: [blockingEvent], nextPageToken: "1" },
					{ items: [overlappingEvent] }
				]
			}),
			calendarIds: ["primary"],
			timeMax,
			timeMin,
			timeZone
		});

		expect(busyWindows).toHaveLength(2);
	});
});

describe("getBusyWindows", () => {
	test("loads busy windows for one booking date", async () => {
		const busyWindows = await getBusyWindows({
			calendar: calendarWithPages({ primary: [{ items: [blockingEvent] }] }),
			calendarIds: ["primary"],
			date,
			timeZone
		});

		expect(busyWindows).toEqual([
			{
				calendarId: "primary",
				eventId: "evt-block",
				start: blockingEvent.start?.dateTime,
				end: blockingEvent.end?.dateTime
			}
		]);
	});
});
