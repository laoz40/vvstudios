"use node";

import {
	getGoogleCalendarClient,
	loadGoogleCalendarClient
} from "#convex/googleCalendar/lib/googleCalendarClient";
import { tryGoogleCalendarAvailability } from "#convex/googleCalendar/lib/googleCalendarErrors";
import {
	getBusyWindows,
	getBusyWindowsInRange
} from "#convex/googleCalendar/lib/googleCalendarAvailability";
import {
	bookableRangeBusyWindowsForTimeZone,
	bookableRangeDateArgs,
	dayAvailableBookingTimes,
	type IgnoredBusyEvent
} from "#convex/googleCalendar/lib/calendarAvailabilityLoad";
import { getDateAvailabilityRange } from "#convex/googleCalendar/services/calendarTime";
import type { SessionAvailabilitySettings } from "#convex/sessions/lib/calendarTime";

type LoadedGoogleCalendarClient = ReturnType<typeof getGoogleCalendarClient>;

export type GoogleCalendarAvailabilityError = {
	reason:
		| "GOOGLE_CALENDAR_AVAILABILITY_FAILED"
		| "GOOGLE_CALENDAR_AUTH_FAILED"
		| "GOOGLE_CALENDAR_RATE_LIMITED";
};

function loadBookableRangeBusyWindowsForClient(
	args: { ignoredEvent?: IgnoredBusyEvent; settings: SessionAvailabilitySettings },
	client: LoadedGoogleCalendarClient
) {
	const { startDate, endDate } = bookableRangeDateArgs(args.settings);

	return getDateAvailabilityRange(startDate, endDate, client.timeZone).asyncAndThen((range) =>
		loadBusyWindowsInRange(
			{
				calendar: client.calendar,
				calendarIds: client.calendarIds,
				ignoredEvent: args.ignoredEvent,
				timeZone: client.timeZone
			},
			range
		)
	);
}

function loadBusyWindowsInRange(
	args: {
		calendar: LoadedGoogleCalendarClient["calendar"];
		calendarIds: string[];
		ignoredEvent?: IgnoredBusyEvent;
		timeZone: string;
	},
	range: { timeMin: string; timeMax: string }
) {
	return tryGoogleCalendarAvailability(() =>
		getBusyWindowsInRange({
			calendar: args.calendar,
			calendarIds: args.calendarIds,
			ignoredEvent: args.ignoredEvent,
			timeMax: range.timeMax,
			timeMin: range.timeMin,
			timeZone: args.timeZone
		})
	).andThen((busyWindows: Awaited<ReturnType<typeof getBusyWindowsInRange>>) =>
		bookableRangeBusyWindowsForTimeZone(args.timeZone, busyWindows)
	);
}

export function loadBookableRangeBusyWindowsFromGoogle({
	ignoredEvent,
	settings
}: {
	ignoredEvent?: IgnoredBusyEvent;
	settings: SessionAvailabilitySettings;
}) {
	return loadGoogleCalendarClient("GOOGLE_CALENDAR_AVAILABILITY_FAILED").andThen((client) =>
		loadBookableRangeBusyWindowsForClient({ ignoredEvent, settings }, client)
	);
}

function loadDayAvailableTimesForClient(
	args: { date: string; duration: string; settings: SessionAvailabilitySettings },
	{ calendar, calendarIds, timeZone }: LoadedGoogleCalendarClient
) {
	return tryGoogleCalendarAvailability(() =>
		getBusyWindows({ calendar, calendarIds, date: args.date, timeZone })
	).map((busyWindows: Awaited<ReturnType<typeof getBusyWindows>>) =>
		dayAvailableBookingTimes({ ...args, timeZone }, busyWindows)
	);
}

export function loadDayAvailableBookingTimes({
	date,
	duration,
	settings
}: {
	date: string;
	duration: string;
	settings: SessionAvailabilitySettings;
}) {
	return loadGoogleCalendarClient("GOOGLE_CALENDAR_AVAILABILITY_FAILED").andThen((client) =>
		loadDayAvailableTimesForClient({ date, duration, settings }, client)
	);
}

function loadDayBusyWindowsForClient(
	args: { date: string; ignoredEvent?: IgnoredBusyEvent },
	{ calendar, calendarIds, timeZone }: LoadedGoogleCalendarClient
) {
	return tryGoogleCalendarAvailability(() =>
		getBusyWindows({
			calendar,
			calendarIds,
			date: args.date,
			ignoredEvent: args.ignoredEvent,
			timeZone
		})
	).map((busyWindows: Awaited<ReturnType<typeof getBusyWindows>>) => ({ busyWindows, timeZone }));
}

export function loadDayBusyWindows({
	date,
	ignoredEvent
}: {
	date: string;
	ignoredEvent?: IgnoredBusyEvent;
}) {
	return loadGoogleCalendarClient("GOOGLE_CALENDAR_AVAILABILITY_FAILED").andThen((client) =>
		loadDayBusyWindowsForClient({ date, ignoredEvent }, client)
	);
}
