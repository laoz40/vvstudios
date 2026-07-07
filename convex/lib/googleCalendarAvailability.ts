import type { calendar_v3 } from "googleapis/build/src/apis/calendar/v3";

import { getAvailabilityRange, getEventDateTime, type BusyWindow } from "./bookingCalendarTime";

type GoogleCalendarLike = Pick<calendar_v3.Calendar, "events">;

interface IgnoredBusyEvent {
	calendarId?: string;
	eventId?: string;
}

interface GetBusyWindowsArgs {
	calendar: GoogleCalendarLike;
	calendarIds: string[];
	date: string;
	ignoredEvent?: IgnoredBusyEvent;
	timeZone: string;
}

interface GetBusyWindowsInRangeArgs {
	calendar: GoogleCalendarLike;
	calendarIds: string[];
	ignoredEvent?: IgnoredBusyEvent;
	timeMax: string;
	timeMin: string;
	timeZone: string;
}

// load calendar events for the date range and turn all events into booking blockers
export async function getBusyWindows({
	calendar,
	calendarIds,
	date,
	ignoredEvent,
	timeZone
}: GetBusyWindowsArgs): Promise<BusyWindow[]> {
	const { timeMin, timeMax } = getAvailabilityRange(date);

	return await getBusyWindowsInRange({
		calendar,
		calendarIds,
		ignoredEvent,
		timeMax,
		timeMin,
		timeZone
	});
}

export async function getBusyWindowsInRange({
	calendar,
	calendarIds,
	ignoredEvent,
	timeMax,
	timeMin,
	timeZone
}: GetBusyWindowsInRangeArgs): Promise<BusyWindow[]> {
	const busyWindows: BusyWindow[] = [];

	for (const calendarId of calendarIds) {
		let pageToken: string | undefined;

		do {
			const response = await calendar.events.list({
				calendarId,
				maxResults: 500,
				orderBy: "startTime",
				pageToken,
				singleEvents: true,
				timeMax,
				timeMin,
				timeZone
			});

			for (const event of response.data.items ?? []) {
				if (shouldIgnoreBusyEvent({ calendarId, event, ignoredEvent })) {
					continue;
				}

				const start = getEventDateTime(event.start, timeZone);
				const end = getEventDateTime(event.end, timeZone);

				if (!start || !end) {
					continue;
				}

				busyWindows.push({ calendarId, end, ...(event.id ? { eventId: event.id } : {}), start });
			}

			pageToken = response.data.nextPageToken ?? undefined;
		} while (pageToken);
	}

	return busyWindows;
}

function shouldIgnoreBusyEvent({
	calendarId,
	event,
	ignoredEvent
}: {
	calendarId: string;
	event: calendar_v3.Schema$Event;
	ignoredEvent?: IgnoredBusyEvent;
}) {
	if (!ignoredEvent?.eventId || event.id !== ignoredEvent.eventId) {
		return false;
	}

	return !ignoredEvent.calendarId || ignoredEvent.calendarId === calendarId;
}
