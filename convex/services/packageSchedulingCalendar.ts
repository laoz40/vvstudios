"use node";

import { err, ok, ResultAsync } from "neverthrow";
import { internal } from "#convex/_generated/api";
import type { ActionCtx } from "#convex/_generated/server";
import { getBusyWindows, getBusyWindowsInRange } from "#convex/lib/googleCalendarAvailability";
import { loadGoogleCalendarClient } from "#convex/lib/googleCalendarClient";
import { getGoogleCalendarErrorCode } from "#convex/lib/googleCalendarErrors";
import type { ValidPackageByTokenError } from "#convex/lib/packageScheduling";
import { fromConvexTuple } from "#convex/lib/result";
import { checkGoogleCalendarAvailabilityRateLimit } from "#convex/lib/rateLimits";
import {
	getDateAvailabilityRange,
	groupBusyDaysByMonth,
	groupBusyWindowsByDay,
	isTimeSlotAvailable,
	type BusyDayWindow
} from "#convex/lib/sessionCalendarTime";
import {
	createPackageCalendarEvent,
	getPackageCalendarSyncErrorReason,
	updatePackageCalendarEvent,
	type PackageCalendarDetails,
	type PackageCalendarSyncError,
	type PackageCalendarWriteError
} from "#convex/lib/packageSchedulingCalendar";
import {
	deleteSessionCalendarEvent,
	type SessionCalendarEventRecord
} from "#convex/lib/sessionCalendarEvents";
import { formatDateValue, startOfToday } from "#studio/lib/bookingdatetime";

export type {
	PackageCalendarDetails,
	PackageCalendarWriteError
} from "#convex/lib/packageSchedulingCalendar";

type PackageAvailabilityError =
	| ValidPackageByTokenError
	| { reason: "GOOGLE_CALENDAR_AVAILABILITY_FAILED" }
	| { reason: "GOOGLE_CALENDAR_AUTH_FAILED" }
	| { reason: "GOOGLE_CALENDAR_RATE_LIMITED" };

export function getPackageBusyWindowsService(
	ctx: ActionCtx,
	args: { rateLimitKey: string; token: string }
): ResultAsync<
	{
		busyWindowsByMonth: Record<string, BusyDayWindow[]>;
		packageExpiresAt: number;
		timeZone: string;
	},
	PackageAvailabilityError
> {
	return (
		fromConvexTuple(
			ctx.runQuery(internal.packageScheduling.getValidPackageByToken, {
				now: Date.now(),
				token: args.token
			})
		)
			// Apply both customer and global availability limits before calling Calendar.
			.andThen((packageFromDb) =>
				checkGoogleCalendarAvailabilityRateLimit(ctx, args.rateLimitKey).map(() => packageFromDb)
			)
			// Load Calendar configuration before calculating the package's bookable range.
			.andThen((packageFromDb) =>
				loadGoogleCalendarClient("GOOGLE_CALENDAR_AVAILABILITY_FAILED").map((client) => ({
					client,
					packageFromDb
				}))
			)
			// Parse the complete date range covered by the package scheduling link.
			.andThen(({ client, packageFromDb }) => {
				const startDate = formatDateValue(startOfToday());
				const endDate = formatDateValue(new Date(packageFromDb.expiresAt));

				return getDateAvailabilityRange(startDate, endDate, client.timeZone)
					.mapErr(() => ({ reason: "GOOGLE_CALENDAR_AVAILABILITY_FAILED" as const }))
					.map((availabilityRange) => ({ availabilityRange, client, packageFromDb }));
			})
			// Fetch every Calendar event that can block a package booking.
			.andThen(({ availabilityRange, client, packageFromDb }) =>
				ResultAsync.fromPromise(
					getBusyWindowsInRange({
						calendar: client.calendar,
						calendarIds: client.calendarIds,
						timeMax: availabilityRange.timeMax,
						timeMin: availabilityRange.timeMin,
						timeZone: client.timeZone
					}),
					(error) => ({
						reason: getGoogleCalendarErrorCode(error, "GOOGLE_CALENDAR_AVAILABILITY_FAILED")
					})
				).map((busyWindows) => ({ busyWindows, client, packageFromDb }))
			)
			// Group busy days by month.
			.andThen(({ busyWindows, client, packageFromDb }) =>
				groupBusyWindowsByDay(busyWindows, client.timeZone)
					.mapErr(() => ({ reason: "GOOGLE_CALENDAR_AVAILABILITY_FAILED" as const }))
					.map((busyDays) => ({
						busyWindowsByMonth: groupBusyDaysByMonth(busyDays),
						packageExpiresAt: packageFromDb.expiresAt,
						timeZone: client.timeZone
					}))
			)
	);
}

export function savePackageSessionCalendarEventService(args: {
	session: SessionCalendarEventRecord | null;
	details: PackageCalendarDetails;
}): ResultAsync<{ googleCalendarId?: string; googleEventId?: string }, PackageCalendarWriteError> {
	return (
		loadGoogleCalendarClient("GOOGLE_CALENDAR_SYNC_FAILED")
			// Confirm the requested slot remains free before writing a Calendar event.
			.andThen((client) => {
				const ignoredEvent = args.session
					? { calendarId: args.session.googleCalendarId, eventId: args.session.googleEventId }
					: undefined;

				return ResultAsync.fromPromise(
					getBusyWindows({
						calendar: client.calendar,
						calendarIds: client.calendarIds,
						date: args.details.date,
						ignoredEvent,
						timeZone: client.timeZone
					}),
					(error): PackageCalendarWriteError => ({
						reason: getGoogleCalendarErrorCode(error, "GOOGLE_CALENDAR_SYNC_FAILED")
					})
				).map((busyWindows) => ({ busyWindows, client }));
			})
			.andThen(({ busyWindows, client }) => {
				const isAvailable = isTimeSlotAvailable({
					busyWindows,
					date: args.details.date,
					duration: args.details.duration,
					eventBufferMinutes: args.details.eventBufferMinutes,
					time: args.details.time,
					timeZone: client.timeZone
				});

				return isAvailable ? ok(client) : err({ reason: "BOOKING_TIME_UNAVAILABLE" as const });
			})
			// Create a new event or update the existing package session event.
			.andThen((client) =>
				args.session
					? updatePackageCalendarEvent(client, args.session, args.details)
					: createPackageCalendarEvent(client, args.details)
			)
	);
}

export function deletePackageSessionCalendarEventService(
	session: SessionCalendarEventRecord
): ResultAsync<{ calendarEventDeleted: boolean }, PackageCalendarSyncError> {
	return (
		loadGoogleCalendarClient("GOOGLE_CALENDAR_SYNC_FAILED")
			// Delete the saved event, including declined invitations found by session details.
			.andThen(({ calendar, calendarId, timeZone }) =>
				ResultAsync.fromSafePromise(
					deleteSessionCalendarEvent({ session, client: { calendar, calendarId, timeZone } })
				)
					.andThen((result) => result)
					.mapErr(
						(error): PackageCalendarSyncError => ({
							reason: getPackageCalendarSyncErrorReason(error.reason)
						})
					)
			)
	);
}
