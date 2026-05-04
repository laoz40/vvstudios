import type { calendar_v3 } from "googleapis/build/src/apis/calendar/v3";

import { getAvailabilityRange, getEventDateTime, type BusyWindow } from "./bookingTimeUtils";

type GoogleCalendarLike = Pick<calendar_v3.Calendar, "events">;

interface GetBusyWindowsArgs {
	calendar: GoogleCalendarLike;
	calendarIds: string[];
	date: string;
	timeZone: string;
}

interface GetBusyWindowsInRangeArgs {
	calendar: GoogleCalendarLike;
	calendarIds: string[];
	timeMax: string;
	timeMin: string;
	timeZone: string;
}

// load calendar events for the date range and turn all events into booking blockers
export async function getBusyWindows({
	calendar,
	calendarIds,
	date,
	timeZone,
}: GetBusyWindowsArgs): Promise<BusyWindow[]> {
	const { timeMin, timeMax } = getAvailabilityRange(date);

	return await getBusyWindowsInRange({
		calendar,
		calendarIds,
		timeMax,
		timeMin,
		timeZone,
	});
}

export async function getBusyWindowsInRange({
	calendar,
	calendarIds,
	timeMax,
	timeMin,
	timeZone,
}: GetBusyWindowsInRangeArgs): Promise<BusyWindow[]> {
	const busyWindows: BusyWindow[] = [];

	for (const calendarId of calendarIds) {
		let pageToken: string | undefined;

		do {
			const response = await calendar.events.list({
				calendarId,
				maxResults: 2500,
				orderBy: "startTime",
				pageToken,
				singleEvents: true,
				timeMax,
				timeMin,
				timeZone,
			});

			for (const event of response.data.items ?? []) {
				const start = getEventDateTime(event.start, timeZone);
				const end = getEventDateTime(event.end, timeZone);

				if (!start || !end) {
					continue;
				}

				busyWindows.push({ start, end });
			}

			pageToken = response.data.nextPageToken ?? undefined;
		} while (pageToken);
	}

	return busyWindows;
}
