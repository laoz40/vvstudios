"use node";

import { ResultAsync } from "neverthrow";
import { formatDateValue, getLastBookableDate, startOfToday } from "#studio/lib/bookingdatetime";
import type { ActionCtx } from "#convex/_generated/server";
import { loadValidRescheduleLinkAndSession } from "#convex/lib/sessions/sessionCalendarActionBoundaries";
import {
	getBusyWindows,
	getBusyWindowsInRange
} from "#convex/lib/googleCalendar/googleCalendarAvailability";
import {
	getGoogleCalendarClient,
	loadGoogleCalendarClient
} from "#convex/lib/googleCalendar/googleCalendarClient";
import {
	calendarErrorSchema,
	mapCalendarErrorCode
} from "#convex/lib/googleCalendar/googleCalendarErrors";
import { checkGoogleCalendarAvailabilityRateLimit } from "#convex/lib/rateLimits";
import { tryPromise } from "#convex/lib/result";
import {
	checkSessionMeetsAvailabilitySettings,
	getAvailableTimeOptions,
	getDateAvailabilityRange,
	groupBusyDaysByMonth,
	groupBusyWindowsByDay,
	type BusyDayWindow,
	type SessionAvailabilitySettings
} from "#convex/lib/sessions/sessionCalendarTime";
import { getBookingSettingsService } from "#convex/services/booking/bookingSettings";
import type { RescheduleLinkLookupError } from "#convex/services/sessions/sessionReschedule";
import type { AdminSessionUpdateError } from "#convex/lib/sessions/sessionAdminEdit";

type IgnoredBusyEvent = { calendarId?: string; eventId?: string };

type GoogleCalendarAvailabilityError = {
	reason:
		| "BOOKING_INVALID_DATE"
		| "BOOKING_INVALID_TIME"
		| "GOOGLE_CALENDAR_AVAILABILITY_FAILED"
		| "GOOGLE_CALENDAR_AUTH_FAILED"
		| "GOOGLE_CALENDAR_RATE_LIMITED"
		| "INVALID_ZONED_TIME";
};

export type GetAvailableRescheduleTimesError =
	| RescheduleLinkLookupError
	| GoogleCalendarAvailabilityError;

function getBookableRangeBusyWindowsFromGoogleCalendar({
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
						catch: (error) => {
							const parsedError = calendarErrorSchema.safeParse(error);

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

export function getBookableRangeBusyWindowsService(ctx: ActionCtx, args: { rateLimitKey: string }) {
	return checkGoogleCalendarAvailabilityRateLimit(ctx, args.rateLimitKey)
		.andThen(() => getBookingSettingsService(ctx))
		.andThen((settings) => getBookableRangeBusyWindowsFromGoogleCalendar({ settings }));
}

export function getAvailableBookingTimesService(
	ctx: ActionCtx,
	args: { date: string; duration: string }
) {
	return getBookingSettingsService(ctx).andThen((settings) =>
		loadGoogleCalendarClient("GOOGLE_CALENDAR_AVAILABILITY_FAILED").andThen(
			({ calendar, calendarIds, timeZone }) =>
				tryPromise({
					try: () => getBusyWindows({ calendar, calendarIds, date: args.date, timeZone }),
					catch: (error) => {
						const parsedError = calendarErrorSchema.safeParse(error);

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
						date: args.date,
						duration: args.duration,
						eventBufferMinutes: settings.eventBufferMinutes,
						timeZone
					})
				}))
		)
	);
}

export function getRescheduleBookableRangeBusyWindowsService(
	ctx: ActionCtx,
	args: { rateLimitKey: string; token: string }
): ResultAsync<
	{ busyWindowsByMonth: Record<string, BusyDayWindow[]>; timeZone: string },
	GetAvailableRescheduleTimesError
> {
	return checkGoogleCalendarAvailabilityRateLimit(ctx, args.rateLimitKey)
		.andThen(() => loadValidRescheduleLinkAndSession(ctx, { now: Date.now(), token: args.token }))
		.andThen((details) => getBookingSettingsService(ctx).map((settings) => ({ details, settings })))
		.andThen(({ details, settings }) =>
			getBookableRangeBusyWindowsFromGoogleCalendar({
				ignoredEvent: {
					calendarId: details.session.googleCalendarId,
					eventId: details.session.googleEventId
				},
				settings
			})
		);
}

export function getAvailableRescheduleTimesService(
	ctx: ActionCtx,
	args: { date: string; token: string }
): ResultAsync<{ timeZone: string; times: string[] }, GetAvailableRescheduleTimesError> {
	return loadValidRescheduleLinkAndSession(ctx, { now: Date.now(), token: args.token })
		.andThen((details) => getBookingSettingsService(ctx).map((settings) => ({ details, settings })))
		.andThen(({ details, settings }) =>
			tryPromise({
				try: () => Promise.resolve().then(() => getGoogleCalendarClient()),
				catch: (error) => {
					const parsedError = calendarErrorSchema.safeParse(error);

					return {
						reason: parsedError.success
							? mapCalendarErrorCode(parsedError.data, "GOOGLE_CALENDAR_AVAILABILITY_FAILED")
							: "GOOGLE_CALENDAR_AVAILABILITY_FAILED"
					};
				}
			}).andThen(({ calendar, calendarIds, timeZone }) =>
				tryPromise({
					try: () =>
						getBusyWindows({
							calendar,
							calendarIds,
							date: args.date,
							ignoredEvent: {
								calendarId: details.session.googleCalendarId,
								eventId: details.session.googleEventId
							},
							timeZone
						}),
					catch: (error) => {
						const parsedError = calendarErrorSchema.safeParse(error);

						return {
							reason: parsedError.success
								? mapCalendarErrorCode(parsedError.data, "GOOGLE_CALENDAR_AVAILABILITY_FAILED")
								: "GOOGLE_CALENDAR_AVAILABILITY_FAILED"
						};
					}
				}).map((busyWindows) => {
					const calendarAvailableTimes = getAvailableTimeOptions({
						busyWindows,
						date: args.date,
						duration: details.session.duration,
						eventBufferMinutes: settings.eventBufferMinutes,
						timeZone
					});

					const now = Date.now();

					const times = calendarAvailableTimes.filter((time) =>
						checkSessionMeetsAvailabilitySettings({
							date: args.date,
							duration: details.session.duration,
							now,
							settings,
							time,
							timeZone
						}).isOk()
					);

					return { timeZone, times };
				})
			)
		);
}

export type { RescheduleSessionError } from "#convex/services/googleCalendar/sessionRescheduleWorkflow";

export type CancelBookingFromAdminError = {
	reason:
		| "NOT_AUTHENTICATED"
		| "NOT_AUTHORIZED"
		| "BOOKING_NOT_FOUND"
		| "GOOGLE_CALENDAR_AUTH_FAILED"
		| "GOOGLE_CALENDAR_DELETE_FAILED"
		| "GOOGLE_CALENDAR_RATE_LIMITED";
};

export type UpdateSessionFromAdminError =
	| AdminSessionUpdateError
	| { reason: "NOT_AUTHENTICATED" }
	| { reason: "NOT_AUTHORIZED" }
	| { reason: "BOOKING_NOT_FOUND" };
