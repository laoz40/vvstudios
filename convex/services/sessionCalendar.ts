"use node";

import { err, ok, ResultAsync } from "neverthrow";
import { api, internal } from "#convex/_generated/api";
import type { Doc, Id } from "#convex/_generated/dataModel";
import { formatDateValue, getLastBookableDate, startOfToday } from "#studio/lib/bookingdatetime";
import type { ActionCtx } from "#convex/_generated/server";
import { getAdminIdentity } from "#convex/lib/auth";
import { sendBookingInvoiceEmailsForBooking } from "#convex/lib/email";
import { getBusyWindows, getBusyWindowsInRange } from "#convex/lib/googleCalendarAvailability";
import {
	getGoogleCalendarClient,
	loadGoogleCalendarClient
} from "#convex/lib/googleCalendarClient";
import { getGoogleCalendarErrorCode } from "#convex/lib/googleCalendarErrors";
import {
	getSessionStartAt,
	isValidSessionRemainingBalanceAmount,
	updateSessionFromAdminWithGoogleCalendar,
	type AdminSessionUpdateArgs,
	type AdminSessionUpdateError,
	type AdminSessionUpdateResult
} from "#convex/lib/sessionAdminEdit";
import { deleteSessionCalendarEvent } from "#convex/lib/sessionCalendarEvents";
import { getBookingSubmitRateLimitKey } from "#convex/lib/bookingSubmission";
import { getSessionFromQuery } from "#convex/lib/sessionLookup";
import {
	checkBookingSubmitRateLimit,
	checkGoogleCalendarAvailabilityRateLimit
} from "#convex/lib/rateLimits";
import { fromConvexTuple } from "#convex/lib/result";
import { getRescheduleUrlForToken } from "#convex/lib/sessionRescheduleLinks";
import {
	lockAndReserveReschedule,
	saveRescheduledSession,
	updateRescheduleCalendar,
	validateRescheduleTiming,
	type RescheduleSessionArgs,
	type ValidRescheduleDetails
} from "#convex/lib/sessionRescheduleWorkflow";
import {
	checkSessionMeetsAvailabilitySettings,
	getAvailableTimeOptions,
	getDateAvailabilityRange,
	groupBusyDaysByMonth,
	groupBusyWindowsByDay,
	type BusyDayWindow,
	type SessionAvailabilitySettings
} from "#convex/lib/sessionCalendarTime";
import { getBookingSettingsService } from "#convex/services/bookingSettings";
import type { RescheduleLinkLookupError } from "#convex/services/sessionReschedule";

export type { RescheduleSessionArgs } from "#convex/lib/sessionRescheduleWorkflow";
type IgnoredBusyEvent = { calendarId?: string; eventId?: string };
type GoogleCalendarAvailabilityError = {
	reason:
		| "GOOGLE_CALENDAR_AVAILABILITY_FAILED"
		| "GOOGLE_CALENDAR_AUTH_FAILED"
		| "GOOGLE_CALENDAR_RATE_LIMITED";
};

export type GetAvailableRescheduleTimesError =
	| RescheduleLinkLookupError
	| GoogleCalendarAvailabilityError;

function mapGoogleCalendarAvailabilityError(error: unknown): GoogleCalendarAvailabilityError {
	return { reason: getGoogleCalendarErrorCode(error, "GOOGLE_CALENDAR_AVAILABILITY_FAILED") };
}

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

			return getDateAvailabilityRange(startDate, endDate, timeZone)
				.mapErr(() => ({ reason: "GOOGLE_CALENDAR_AVAILABILITY_FAILED" as const }))
				.asyncAndThen(({ timeMin, timeMax }) =>
					ResultAsync.fromPromise(
						getBusyWindowsInRange({
							calendar,
							calendarIds,
							ignoredEvent,
							timeMax,
							timeMin,
							timeZone
						}),
						mapGoogleCalendarAvailabilityError
					).andThen((busyWindows) =>
						groupBusyWindowsByDay(busyWindows, timeZone)
							.mapErr(() => ({ reason: "GOOGLE_CALENDAR_AVAILABILITY_FAILED" as const }))
							.map((busyDays) => ({ busyWindowsByMonth: groupBusyDaysByMonth(busyDays), timeZone }))
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
				ResultAsync.fromPromise(
					getBusyWindows({ calendar, calendarIds, date: args.date, timeZone }),
					mapGoogleCalendarAvailabilityError
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
		.andThen(() =>
			fromConvexTuple(
				ctx.runQuery(internal.sessionReschedule.getValidRescheduleLinkAndSession, {
					now: Date.now(),
					token: args.token
				})
			)
		)
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
	return fromConvexTuple(
		ctx.runQuery(internal.sessionReschedule.getValidRescheduleLinkAndSession, {
			now: Date.now(),
			token: args.token
		})
	)
		.andThen((details) => getBookingSettingsService(ctx).map((settings) => ({ details, settings })))
		.andThen(({ details, settings }) =>
			ResultAsync.fromPromise(
				Promise.resolve().then(() => getGoogleCalendarClient()),
				(error): GoogleCalendarAvailabilityError => ({
					reason: getGoogleCalendarErrorCode(error, "GOOGLE_CALENDAR_AVAILABILITY_FAILED")
				})
			).andThen(({ calendar, calendarIds, timeZone }) =>
				ResultAsync.fromPromise(
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
					(error): GoogleCalendarAvailabilityError => ({
						reason: getGoogleCalendarErrorCode(error, "GOOGLE_CALENDAR_AVAILABILITY_FAILED")
					})
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

export type RescheduleSessionError =
	| RescheduleLinkLookupError
	| AdminSessionUpdateError
	| { reason: "BOOKING_RATE_LIMITED"; retryAfter?: number };

export type UpdateSessionFromAdminError =
	| AdminSessionUpdateError
	| { reason: "NOT_AUTHENTICATED" }
	| { reason: "NOT_AUTHORIZED" }
	| { reason: "BOOKING_NOT_FOUND" };

export type DeleteSessionFromAdminError = {
	reason:
		| "NOT_AUTHENTICATED"
		| "NOT_AUTHORIZED"
		| "BOOKING_NOT_FOUND"
		| "GOOGLE_CALENDAR_AUTH_FAILED"
		| "GOOGLE_CALENDAR_DELETE_FAILED"
		| "GOOGLE_CALENDAR_RATE_LIMITED";
};

type RescheduledSessionTimingUpdate = {
	googleCalendarId?: string;
	googleEventId?: string;
	sessionStartAt: number;
};

async function finishRescheduledSession(
	session: Doc<"bookings">,
	args: RescheduleSessionArgs,
	timingUpdate: RescheduledSessionTimingUpdate,
	settings: SessionAvailabilitySettings
) {
	const updatedBooking = {
		...session,
		date: args.date,
		time: args.time,
		sessionStartAt: timingUpdate.sessionStartAt,
		googleCalendarId: timingUpdate.googleCalendarId ?? session.googleCalendarId,
		googleEventId: timingUpdate.googleEventId ?? session.googleEventId
	};
	const emailResult = await sendBookingInvoiceEmailsForBooking(updatedBooking, {
		leadTimeMinutes: settings.leadTimeMinutes,
		rescheduleUrl: getRescheduleUrlForToken(args.token)
	});

	if (emailResult.isErr()) {
		return ok({ bookingId: session._id, warning: "INVOICE_SEND_FAILED" as const });
	}

	return ok({ bookingId: session._id });
}

export function rescheduleSessionService(
	ctx: ActionCtx,
	args: RescheduleSessionArgs
): ResultAsync<
	{ bookingId: Id<"bookings">; warning?: "INVOICE_SEND_FAILED" },
	RescheduleSessionError
> {
	return (
		// Check that the link is valid and apply the customer's submit rate limit.
		fromConvexTuple(
			ctx.runQuery(internal.sessionReschedule.getValidRescheduleLinkAndSession, {
				now: Date.now(),
				token: args.token
			})
		)
			.andThen((details: ValidRescheduleDetails) =>
				checkBookingSubmitRateLimit(ctx, getBookingSubmitRateLimitKey(details.session.email)).map(
					() => details
				)
			)
			// Load settings and validate the target before locking the link.
			.andThen((details) =>
				ResultAsync.fromSafePromise(ctx.runQuery(api.bookingSettings.get, {})).map((settings) => ({
					details,
					settings
				}))
			)
			.andThen(({ details, settings }) =>
				loadGoogleCalendarClient("GOOGLE_CALENDAR_AVAILABILITY_FAILED").map((calendarClient) => ({
					calendarClient,
					details,
					settings
				}))
			)
			.andThen(({ calendarClient, details, settings }) =>
				validateRescheduleTiming(args, details.session, settings, calendarClient).andThen(() =>
					getSessionStartAt(args.date, args.time, calendarClient.timeZone).map(
						(sessionStartAt) => ({ calendarClient, details, sessionStartAt, settings })
					)
				)
			)
			// Lock the link and reserve the target before changing Google Calendar.
			.andThen(({ calendarClient, details, sessionStartAt, settings }) =>
				lockAndReserveReschedule(ctx, details, sessionStartAt, settings).map((state) => ({
					calendarClient,
					state
				}))
			)
			// Move Calendar first; clear the reservation and then unlock on provider failure.
			.andThen(({ calendarClient, state }) =>
				updateRescheduleCalendar(ctx, args, state, calendarClient)
			)
			// Persist the new time; preserve the same compensation ordering on save failure.
			.andThen((state) => saveRescheduledSession(ctx, args, state))
			// Unlock after persistence, then send the updated invoice email.
			.andThen((state) =>
				fromConvexTuple(
					ctx.runMutation(internal.sessionReschedule.unlockRescheduleLink, {
						linkId: state.link._id,
						lockedAt: state.lockedAt,
						expiresAt: state.timingUpdate.sessionStartAt
					})
				).map(() => state)
			)
			.andThen(({ session, settings, timingUpdate }) =>
				ResultAsync.fromSafePromise(
					finishRescheduledSession(session, args, timingUpdate, settings)
				).andThen((result) => result)
			)
	);
}

export function updateSessionFromAdminService(
	ctx: ActionCtx,
	args: AdminSessionUpdateArgs
): ResultAsync<AdminSessionUpdateResult, UpdateSessionFromAdminError> {
	return (
		getAdminIdentity(ctx)
			.andThen(() => {
				return isValidSessionRemainingBalanceAmount(args.remainingBalanceAmount)
					? ok(null)
					: err({ reason: "BOOKING_INVALID_INPUT" as const });
			})
			// Load the booking only after authorization and input validation succeed.
			.andThen(() => getSessionFromQuery(ctx, args.bookingId))
			// Load settings before applying Calendar and persistence changes.
			.andThen((session) =>
				ResultAsync.fromSafePromise(ctx.runQuery(api.bookingSettings.get, {})).map((settings) => ({
					session,
					settings
				}))
			)
			.andThen(({ session, settings }) =>
				loadGoogleCalendarClient("GOOGLE_CALENDAR_AVAILABILITY_FAILED").map((client) => ({
					client,
					session,
					settings
				}))
			)
			// Apply the edit while preserving reservation and Calendar compensation behavior.
			.andThen(({ client, session, settings }) =>
				ResultAsync.fromSafePromise(
					updateSessionFromAdminWithGoogleCalendar({ args, session, client, ctx, settings })
				).andThen((result) => result)
			)
	);
}

export function deleteSessionFromAdminService(
	ctx: ActionCtx,
	bookingId: Id<"bookings">
): ResultAsync<{ deleted: boolean }, DeleteSessionFromAdminError> {
	return (
		getAdminIdentity(ctx)
			// Load the booking only after admin authorization succeeds.
			.andThen(() => getSessionFromQuery(ctx, bookingId))
			.andThen((session) =>
				loadGoogleCalendarClient("GOOGLE_CALENDAR_DELETE_FAILED").map((client) => ({
					client,
					session
				}))
			)
			// Delete the provider event before cancelling the booking in Convex.
			.andThen(({ client, session }) =>
				ResultAsync.fromSafePromise(deleteSessionCalendarEvent({ session, client })).andThen(
					(result) => result
				)
			)
			// Persist cancellation after deletion succeeds or the provider event is already missing.
			.andThen(() =>
				fromConvexTuple(
					ctx.runMutation(internal.sessions.markSessionCalendarEventDeleted, { bookingId })
				).map(() => ({ deleted: true }))
			)
	);
}
