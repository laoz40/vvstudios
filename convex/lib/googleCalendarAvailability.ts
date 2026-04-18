import type { calendar_v3 } from "googleapis/build/src/apis/calendar/v3";

import { getAvailabilityRange, type BusyWindow } from "./bookingTimeUtils";

type GoogleCalendarLike = Pick<calendar_v3.Calendar, "freebusy">;

interface GetBusyWindowsArgs {
	calendar: GoogleCalendarLike;
	calendarId: string;
	date: string;
	timeZone: string;
}

// load calendar availability for the date range and turn busy windows into booking blockers
export async function getBusyWindows({
	calendar,
	calendarId,
	date,
	timeZone,
}: GetBusyWindowsArgs): Promise<BusyWindow[]> {
	const { timeMin, timeMax } = getAvailabilityRange(date);

	const response = await calendar.freebusy.query({
		requestBody: {
			items: [{ id: calendarId }],
			timeMax,
			timeMin,
			timeZone,
		},
	});

	const busyWindows = response.data.calendars?.[calendarId]?.busy ?? [];

	return busyWindows.flatMap((window) => {
		if (!window.start || !window.end) {
			return [];
		}

		return [{ start: window.start, end: window.end }];
	});
}
