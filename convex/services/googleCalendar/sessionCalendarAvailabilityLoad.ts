"use node";

import {
	getGoogleCalendarClient,
	loadGoogleCalendarClient
} from "#convex/lib/googleCalendar/googleCalendarClient";
import { tryGoogleCalendarAvailability } from "#convex/lib/googleCalendar/googleCalendarErrors";
import {
	getBusyWindows,
	getBusyWindowsInRange
} from "#convex/lib/googleCalendar/googleCalendarAvailability";
import {
	getAvailableTimeOptions,
	groupBusyDaysByMonth,
	groupBusyWindowsByDay,
	type BusyDayWindow,
	type SessionAvailabilitySettings
} from "#convex/lib/sessions/sessionCalendarTime";
import { getDateAvailabilityRange } from "#convex/services/googleCalendar/sessionCalendarTime";
import { formatDateValue, getLastBookableDate, startOfToday } from "#studio/lib/bookingdatetime";

type IgnoredBusyEvent = { calendarId?: string; eventId?: string };

type LoadedGoogleCalendarClient = ReturnType<typeof getGoogleCalendarClient>;

export type GoogleCalendarAvailabilityError = {
	reason:
		| "GOOGLE_CALENDAR_AVAILABILITY_FAILED"
		| "GOOGLE_CALENDAR_AUTH_FAILED"
		| "GOOGLE_CALENDAR_RATE_LIMITED";
};

function bookableRangeBusyDaysStep(timeZone: string, busyDays: BusyDayWindow[]) {
	return { busyWindowsByMonth: groupBusyDaysByMonth(busyDays), timeZone };
}

function bookableRangeBusyWindowsForTimeZoneStep(
	timeZone: string,
	busyWindows: Awaited<ReturnType<typeof getBusyWindowsInRange>>
) {
	return groupBusyWindowsByDay(busyWindows, timeZone).map((busyDays: BusyDayWindow[]) =>
		bookableRangeBusyDaysStep(timeZone, busyDays)
	);
}

function loadBookableRangeBusyWindowsForClientStep(
	args: { ignoredEvent?: IgnoredBusyEvent; settings: SessionAvailabilitySettings },
	{ calendar, calendarIds, timeZone }: LoadedGoogleCalendarClient
) {
	const today = startOfToday();
	const startDate = formatDateValue(today);
	const endDate = formatDateValue(getLastBookableDate(today, args.settings.maxDaysAhead));

	return getDateAvailabilityRange(startDate, endDate, timeZone).asyncAndThen((_value) =>
		loadBusyWindowsInRangeStep(
			{ calendar, calendarIds, ignoredEvent: args.ignoredEvent, timeZone },
			_value
		)
	);
}

function loadBusyWindowsInRangeStep(
	args: {
		calendar: Parameters<typeof getBusyWindowsInRange>[0]["calendar"];
		calendarIds: string[];
		ignoredEvent?: IgnoredBusyEvent;
		timeZone: string;
	},
	{ timeMin, timeMax }: { timeMin: string; timeMax: string }
) {
	return tryGoogleCalendarAvailability(() =>
		getBusyWindowsInRange({
			calendar: args.calendar,
			calendarIds: args.calendarIds,
			ignoredEvent: args.ignoredEvent,
			timeMax,
			timeMin,
			timeZone: args.timeZone
		})
	).andThen((busyWindows: Awaited<ReturnType<typeof getBusyWindowsInRange>>) =>
		bookableRangeBusyWindowsForTimeZoneStep(args.timeZone, busyWindows)
	);
}

export function loadBookableRangeBusyWindowsFromGoogle({
	ignoredEvent,
	settings
}: {
	ignoredEvent?: IgnoredBusyEvent;
	settings: SessionAvailabilitySettings;
}) {
	return loadGoogleCalendarClient("GOOGLE_CALENDAR_AVAILABILITY_FAILED").andThen((_value) =>
		loadBookableRangeBusyWindowsForClientStep({ ignoredEvent, settings }, _value)
	);
}

function dayAvailableBookingTimesStep(
	args: { date: string; duration: string; settings: SessionAvailabilitySettings; timeZone: string },
	busyWindows: Awaited<ReturnType<typeof getBusyWindows>>
) {
	return {
		timeZone: args.timeZone,
		times: getAvailableTimeOptions({
			busyWindows,
			date: args.date,
			duration: args.duration,
			eventBufferMinutes: args.settings.eventBufferMinutes,
			timeZone: args.timeZone
		})
	};
}

function loadDayAvailableTimesForClientStep(
	args: { date: string; duration: string; settings: SessionAvailabilitySettings },
	{ calendar, calendarIds, timeZone }: LoadedGoogleCalendarClient
) {
	return tryGoogleCalendarAvailability(() =>
		getBusyWindows({ calendar, calendarIds, date: args.date, timeZone })
	).map((busyWindows: Awaited<ReturnType<typeof getBusyWindows>>) =>
		dayAvailableBookingTimesStep({ ...args, timeZone }, busyWindows)
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
	return loadGoogleCalendarClient("GOOGLE_CALENDAR_AVAILABILITY_FAILED").andThen((_value) =>
		loadDayAvailableTimesForClientStep({ date, duration, settings }, _value)
	);
}

function pairBusyWindowsWithTimeZoneStep(
	timeZone: string,
	busyWindows: Awaited<ReturnType<typeof getBusyWindows>>
) {
	return { busyWindows, timeZone };
}

function loadDayBusyWindowsForClientStep(
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
	).map((busyWindows: Awaited<ReturnType<typeof getBusyWindows>>) =>
		pairBusyWindowsWithTimeZoneStep(timeZone, busyWindows)
	);
}

export function loadDayBusyWindows({
	date,
	ignoredEvent
}: {
	date: string;
	ignoredEvent?: IgnoredBusyEvent;
}) {
	return loadGoogleCalendarClient("GOOGLE_CALENDAR_AVAILABILITY_FAILED").andThen((_value) =>
		loadDayBusyWindowsForClientStep({ date, ignoredEvent }, _value)
	);
}
