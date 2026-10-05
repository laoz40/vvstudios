"use node";

import { ResultAsync } from "neverthrow";
import { internal } from "#convex/_generated/api";
import type { Id } from "#convex/_generated/dataModel";
import { formatDateValue, getLastBookableDate, startOfToday } from "#studio/lib/bookingdatetime";
import type { ActionCtx } from "#convex/_generated/server";
import { requirePermissionActions } from "#convex/services/auth";
import { loadValidRescheduleLinkAndSession } from "#convex/lib/sessions/sessionCalendarActionBoundaries";
import {
	getBusyWindows,
	getBusyWindowsInRange
} from "#convex/lib/googleCalendar/googleCalendarAvailability";
import { cleanupCancelledSessionDriveService } from "#convex/services/drive/cleanupCancelledSessionDrive";
import {
	getGoogleCalendarClient,
	loadGoogleCalendarClient
} from "#convex/lib/googleCalendar/googleCalendarClient";
import { calendarResultAsync } from "#convex/lib/googleCalendar/googleCalendarErrors";
import { deleteSessionCalendarEvent } from "#convex/services/googleCalendar/sessionCalendarEventWorkflow";
import { getSessionFromQuery } from "#convex/lib/sessions/sessionLookup";
import { checkGoogleCalendarAvailabilityRateLimit } from "#convex/lib/rateLimits";
import { fromConvexTuple } from "#convex/lib/result";
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
import { loadBookingAvailabilitySettings } from "#convex/lib/booking/bookingConfirmationActionBoundaries";
import {
	finishReschedule,
	loadRescheduleTargetAndValidate,
	lockAndReserve,
	persistRescheduleAfterCalendar,
	syncCalendar,
	type RescheduleSessionArgs,
	type RescheduleSessionError
} from "#convex/services/googleCalendar/sessionRescheduleWorkflow";
import {
	persistAdminSessionGoogleUpdate,
	notifyHostIfNeeded
} from "#convex/services/googleCalendar/sessionAdminUpdateWorkflow";
import type {
	AdminSessionUpdateArgs,
	AdminSessionUpdateError,
	AdminSessionUpdateResult
} from "#convex/lib/sessions/sessionAdminEdit";

export type { RescheduleSessionArgs };

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
					calendarResultAsync(
						getBusyWindowsInRange({
							calendar,
							calendarIds,
							ignoredEvent,
							timeMax,
							timeMin,
							timeZone
						}),
						"GOOGLE_CALENDAR_AVAILABILITY_FAILED"
					).andThen((busyWindows) =>
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
				calendarResultAsync(
					getBusyWindows({ calendar, calendarIds, date: args.date, timeZone }),
					"GOOGLE_CALENDAR_AVAILABILITY_FAILED"
				).map((busyWindows) => ({
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
			calendarResultAsync(
				Promise.resolve().then(() => getGoogleCalendarClient()),
				"GOOGLE_CALENDAR_AVAILABILITY_FAILED"
			).andThen(({ calendar, calendarIds, timeZone }) =>
				calendarResultAsync(
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
					"GOOGLE_CALENDAR_AVAILABILITY_FAILED"
				).map((busyWindows) => {
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

export function rescheduleSessionService(
	ctx: ActionCtx,
	args: RescheduleSessionArgs
): ResultAsync<
	{ bookingId: Id<"bookings">; warning?: "RESCHEDULE_EMAIL_SEND_FAILED" },
	RescheduleSessionError
> {
	return loadRescheduleTargetAndValidate(ctx, args)
		.andThen(({ calendarClient, details, sessionStartAt, settings }) =>
			lockAndReserve(ctx, details, sessionStartAt, settings).map((state) => ({
				calendarClient,
				state
			}))
		)
		.andThen(({ calendarClient, state }) => syncCalendar(ctx, args, state, calendarClient))
		.andThen((state) => persistRescheduleAfterCalendar(ctx, args, state))
		.andThen(({ session, settings, timingUpdate }) =>
			finishReschedule(session, args, timingUpdate, settings)
		);
}

export type UpdateSessionFromAdminError =
	| AdminSessionUpdateError
	| { reason: "NOT_AUTHENTICATED" }
	| { reason: "NOT_AUTHORIZED" }
	| { reason: "BOOKING_NOT_FOUND" };

function authorizeAdminSessionEdit(ctx: ActionCtx, bookingId: Id<"bookings">) {
	return requirePermissionActions(ctx, "edit:sessions").andThen(() =>
		getSessionFromQuery(ctx, bookingId)
	);
}

function loadAdminSessionEditDeps(ctx: ActionCtx) {
	return loadBookingAvailabilitySettings(ctx).andThen((settings) =>
		loadGoogleCalendarClient("GOOGLE_CALENDAR_AVAILABILITY_FAILED").map((client) => ({
			client,
			settings
		}))
	);
}

export function updateSessionFromAdminService(
	ctx: ActionCtx,
	args: AdminSessionUpdateArgs
): ResultAsync<AdminSessionUpdateResult, UpdateSessionFromAdminError> {
	return authorizeAdminSessionEdit(ctx, args.bookingId)
		.andThen((session) => loadAdminSessionEditDeps(ctx).map((deps) => ({ session, ...deps })))
		.andThen(({ client, session, settings }) =>
			persistAdminSessionGoogleUpdate({ args, session, client, ctx, settings }).andThen((result) =>
				notifyHostIfNeeded(ctx, args, session, settings, result)
			)
		);
}

export function cancelBookingFromAdminService(
	ctx: ActionCtx,
	bookingId: Id<"bookings">
): ResultAsync<{ cancelled: boolean }, CancelBookingFromAdminError> {
	return (
		requirePermissionActions(ctx, "cancel:sessions")
			// Load the booking only after cancel:sessions authorization succeeds.
			.andThen(() => getSessionFromQuery(ctx, bookingId))
			.andThen((session) =>
				loadGoogleCalendarClient("GOOGLE_CALENDAR_DELETE_FAILED").map((client) => ({
					client,
					session
				}))
			)
			// Delete the provider event before cancelling the booking in Convex.
			.andThen(({ client, session }) => deleteSessionCalendarEvent({ session, client }))
			// Persist cancellation after deletion succeeds or the provider event is already missing.
			.andThen(() =>
				fromConvexTuple(
					ctx.runMutation(internal.sessions.markSessionCalendarEventDeleted, { bookingId })
				)
			)
			.andThen(() =>
				cleanupCancelledSessionDriveService(ctx, { bookingId }).map(() => ({ cancelled: true }))
			)
	);
}
