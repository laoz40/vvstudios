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

function bookableRangeBusyDaysStep(timeZone: string) {
	return (busyDays: BusyDayWindow[]) => ({
		busyWindowsByMonth: groupBusyDaysByMonth(busyDays),
		timeZone
	});
}

function bookableRangeBusyWindowsForTimeZoneStep(timeZone: string) {
	return (busyWindows: Awaited<ReturnType<typeof getBusyWindowsInRange>>) =>
		groupBusyWindowsByDay(busyWindows, timeZone).map(bookableRangeBusyDaysStep(timeZone));
}

function loadBookableRangeBusyWindowsForClientStep(args: {
	ignoredEvent?: IgnoredBusyEvent;
	settings: SessionAvailabilitySettings;
}) {
	return ({ calendar, calendarIds, timeZone }: LoadedGoogleCalendarClient) => {
		const today = startOfToday();
		const startDate = formatDateValue(today);
		const endDate = formatDateValue(getLastBookableDate(today, args.settings.maxDaysAhead));

		return getDateAvailabilityRange(startDate, endDate, timeZone).asyncAndThen(
			loadBusyWindowsInRangeStep({
				calendar,
				calendarIds,
				ignoredEvent: args.ignoredEvent,
				timeZone
			})
		);
	};
}

function loadBusyWindowsInRangeStep(args: {
	calendar: Parameters<typeof getBusyWindowsInRange>[0]["calendar"];
	calendarIds: string[];
	ignoredEvent?: IgnoredBusyEvent;
	timeZone: string;
}) {
	return ({ timeMin, timeMax }: { timeMin: string; timeMax: string }) =>
		tryGoogleCalendarAvailability(() =>
			getBusyWindowsInRange({
				calendar: args.calendar,
				calendarIds: args.calendarIds,
				ignoredEvent: args.ignoredEvent,
				timeMax,
				timeMin,
				timeZone: args.timeZone
			})
		).andThen(bookableRangeBusyWindowsForTimeZoneStep(args.timeZone));
}

export function loadBookableRangeBusyWindowsFromGoogle({
	ignoredEvent,
	settings
}: {
	ignoredEvent?: IgnoredBusyEvent;
	settings: SessionAvailabilitySettings;
}) {
	return loadGoogleCalendarClient("GOOGLE_CALENDAR_AVAILABILITY_FAILED").andThen(
		loadBookableRangeBusyWindowsForClientStep({ ignoredEvent, settings })
	);
}

function dayAvailableBookingTimesStep(args: {
	date: string;
	duration: string;
	settings: SessionAvailabilitySettings;
	timeZone: string;
}) {
	return (busyWindows: Awaited<ReturnType<typeof getBusyWindows>>) => ({
		timeZone: args.timeZone,
		times: getAvailableTimeOptions({
			busyWindows,
			date: args.date,
			duration: args.duration,
			eventBufferMinutes: args.settings.eventBufferMinutes,
			timeZone: args.timeZone
		})
	});
}

function loadDayAvailableTimesForClientStep(args: {
	date: string;
	duration: string;
	settings: SessionAvailabilitySettings;
}) {
	return ({ calendar, calendarIds, timeZone }: LoadedGoogleCalendarClient) =>
		tryGoogleCalendarAvailability(() =>
			getBusyWindows({ calendar, calendarIds, date: args.date, timeZone })
		).map(dayAvailableBookingTimesStep({ ...args, timeZone }));
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
	return loadGoogleCalendarClient("GOOGLE_CALENDAR_AVAILABILITY_FAILED").andThen(
		loadDayAvailableTimesForClientStep({ date, duration, settings })
	);
}

function pairBusyWindowsWithTimeZoneStep(timeZone: string) {
	return (busyWindows: Awaited<ReturnType<typeof getBusyWindows>>) => ({ busyWindows, timeZone });
}

function loadDayBusyWindowsForClientStep(args: { date: string; ignoredEvent?: IgnoredBusyEvent }) {
	return ({ calendar, calendarIds, timeZone }: LoadedGoogleCalendarClient) =>
		tryGoogleCalendarAvailability(() =>
			getBusyWindows({
				calendar,
				calendarIds,
				date: args.date,
				ignoredEvent: args.ignoredEvent,
				timeZone
			})
		).map(pairBusyWindowsWithTimeZoneStep(timeZone));
}

export function loadDayBusyWindows({
	date,
	ignoredEvent
}: {
	date: string;
	ignoredEvent?: IgnoredBusyEvent;
}) {
	return loadGoogleCalendarClient("GOOGLE_CALENDAR_AVAILABILITY_FAILED").andThen(
		loadDayBusyWindowsForClientStep({ date, ignoredEvent })
	);
}
