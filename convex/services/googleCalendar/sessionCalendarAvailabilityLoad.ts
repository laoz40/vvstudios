"use node";

import { loadGoogleCalendarClient } from "#convex/lib/googleCalendar/googleCalendarClient";
import {
	calendarErrorSchema,
	mapCalendarErrorCode
} from "#convex/lib/googleCalendar/googleCalendarErrors";
import {
	getBusyWindows,
	getBusyWindowsInRange
} from "#convex/lib/googleCalendar/googleCalendarAvailability";
import { tryPromise } from "#convex/lib/result";
import {
	getAvailableTimeOptions,
	groupBusyDaysByMonth,
	groupBusyWindowsByDay,
	type SessionAvailabilitySettings
} from "#convex/lib/sessions/sessionCalendarTime";
import { getDateAvailabilityRange } from "#convex/services/googleCalendar/sessionCalendarTime";
import { formatDateValue, getLastBookableDate, startOfToday } from "#studio/lib/bookingdatetime";

type IgnoredBusyEvent = { calendarId?: string; eventId?: string };

export type GoogleCalendarAvailabilityError = {
	reason:
		| "GOOGLE_CALENDAR_AVAILABILITY_FAILED"
		| "GOOGLE_CALENDAR_AUTH_FAILED"
		| "GOOGLE_CALENDAR_RATE_LIMITED";
};

export function loadBookableRangeBusyWindowsFromGoogle({
	ignoredEvent,
	settings
}: {
	ignoredEvent?: IgnoredBusyEvent;
	settings: SessionAvailabilitySettings;
}) {
	return loadGoogleCalendarClient("GOOGLE_CALENDAR_AVAILABILITY_FAILED").andThen(
		({ calendar, calendarIds, timeZone }) => {
			const today = startOfToday();
			const startDate = formatDateValue(today);
			const endDate = formatDateValue(getLastBookableDate(today, settings.maxDaysAhead));

			return getDateAvailabilityRange(startDate, endDate, timeZone).asyncAndThen(
				({ timeMin, timeMax }) =>
					tryPromise({
						try: () =>
							getBusyWindowsInRange({
								calendar,
								calendarIds,
								ignoredEvent,
								timeMax,
								timeMin,
								timeZone
							}),
						catch: (caught) => {
							const parsedError = calendarErrorSchema.safeParse(caught);

							return {
								reason: parsedError.success
									? mapCalendarErrorCode(parsedError.data, "GOOGLE_CALENDAR_AVAILABILITY_FAILED")
									: "GOOGLE_CALENDAR_AVAILABILITY_FAILED"
							};
						}
					}).andThen((busyWindows) =>
						groupBusyWindowsByDay(busyWindows, timeZone).map((busyDays) => ({
							busyWindowsByMonth: groupBusyDaysByMonth(busyDays),
							timeZone
						}))
					)
			);
		}
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
	return loadGoogleCalendarClient("GOOGLE_CALENDAR_AVAILABILITY_FAILED").andThen(
		({ calendar, calendarIds, timeZone }) =>
			tryPromise({
				try: () => getBusyWindows({ calendar, calendarIds, date, timeZone }),
				catch: (caught) => {
					const parsedError = calendarErrorSchema.safeParse(caught);

					return {
						reason: parsedError.success
							? mapCalendarErrorCode(parsedError.data, "GOOGLE_CALENDAR_AVAILABILITY_FAILED")
							: "GOOGLE_CALENDAR_AVAILABILITY_FAILED"
					};
				}
			}).map((busyWindows) => ({
				timeZone,
				times: getAvailableTimeOptions({
					busyWindows,
					date,
					duration,
					eventBufferMinutes: settings.eventBufferMinutes,
					timeZone
				})
			}))
	);
}

export function loadDayBusyWindows({
	date,
	ignoredEvent
}: {
	date: string;
	ignoredEvent?: IgnoredBusyEvent;
}) {
	return loadGoogleCalendarClient("GOOGLE_CALENDAR_AVAILABILITY_FAILED").andThen(
		({ calendar, calendarIds, timeZone }) =>
			tryPromise({
				try: () => getBusyWindows({ calendar, calendarIds, date, ignoredEvent, timeZone }),
				catch: (caught) => {
					const parsedError = calendarErrorSchema.safeParse(caught);

					return {
						reason: parsedError.success
							? mapCalendarErrorCode(parsedError.data, "GOOGLE_CALENDAR_AVAILABILITY_FAILED")
							: "GOOGLE_CALENDAR_AVAILABILITY_FAILED"
					};
				}
			}).map((busyWindows) => ({ busyWindows, timeZone }))
	);
}
