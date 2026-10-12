"use node";

import { ok, safeTry } from "neverthrow";

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

	return safeTry(async function* () {
		const range = yield* getDateAvailabilityRange(startDate, endDate, client.timeZone);

		const result = yield* loadBusyWindowsInRange(
			{
				calendar: client.calendar,
				calendarIds: client.calendarIds,
				ignoredEvent: args.ignoredEvent,
				timeZone: client.timeZone
			},
			range
		);

		return ok(result);
	});
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
	return safeTry(async function* () {
		const busyWindows = yield* tryGoogleCalendarAvailability(() =>
			getBusyWindowsInRange({
				calendar: args.calendar,
				calendarIds: args.calendarIds,
				ignoredEvent: args.ignoredEvent,
				timeMax: range.timeMax,
				timeMin: range.timeMin,
				timeZone: args.timeZone
			})
		);

		const result = yield* bookableRangeBusyWindowsForTimeZone(args.timeZone, busyWindows);

		return ok(result);
	});
}

export function loadBookableRangeBusyWindowsFromGoogle({
	ignoredEvent,
	settings
}: {
	ignoredEvent?: IgnoredBusyEvent;
	settings: SessionAvailabilitySettings;
}) {
	return safeTry(async function* () {
		const client = yield* loadGoogleCalendarClient("GOOGLE_CALENDAR_AVAILABILITY_FAILED");
		const result = yield* loadBookableRangeBusyWindowsForClient({ ignoredEvent, settings }, client);

		return ok(result);
	});
}

function loadDayAvailableTimesForClient(
	args: { date: string; duration: string; settings: SessionAvailabilitySettings },
	{ calendar, calendarIds, timeZone }: LoadedGoogleCalendarClient
) {
	return safeTry(async function* () {
		const busyWindows = yield* tryGoogleCalendarAvailability(() =>
			getBusyWindows({ calendar, calendarIds, date: args.date, timeZone })
		);

		return ok(dayAvailableBookingTimes({ ...args, timeZone }, busyWindows));
	});
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
	return safeTry(async function* () {
		const client = yield* loadGoogleCalendarClient("GOOGLE_CALENDAR_AVAILABILITY_FAILED");
		const result = yield* loadDayAvailableTimesForClient({ date, duration, settings }, client);

		return ok(result);
	});
}

function loadDayBusyWindowsForClient(
	args: { date: string; ignoredEvent?: IgnoredBusyEvent },
	{ calendar, calendarIds, timeZone }: LoadedGoogleCalendarClient
) {
	return safeTry(async function* () {
		const busyWindows = yield* tryGoogleCalendarAvailability(() =>
			getBusyWindows({
				calendar,
				calendarIds,
				date: args.date,
				ignoredEvent: args.ignoredEvent,
				timeZone
			})
		);

		return ok({ busyWindows, timeZone });
	});
}

export function loadDayBusyWindows({
	date,
	ignoredEvent
}: {
	date: string;
	ignoredEvent?: IgnoredBusyEvent;
}) {
	return safeTry(async function* () {
		const client = yield* loadGoogleCalendarClient("GOOGLE_CALENDAR_AVAILABILITY_FAILED");
		const result = yield* loadDayBusyWindowsForClient({ date, ignoredEvent }, client);

		return ok(result);
	});
}
