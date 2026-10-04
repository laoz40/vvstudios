"use node";

import { err, ok, ResultAsync } from "neverthrow";
import { internal } from "#convex/_generated/api";
import type { ActionCtx } from "#convex/_generated/server";
import {
	getBusyWindows,
	getBusyWindowsInRange
} from "#convex/lib/googleCalendar/googleCalendarAvailability";
import { loadGoogleCalendarClient } from "#convex/lib/googleCalendar/googleCalendarClient";
import { calendarResultAsync } from "#convex/lib/googleCalendar/googleCalendarErrors";
import type { ValidPackageByTokenError } from "#convex/lib/packages/packageScheduling";
import { fromConvexTuple } from "#convex/lib/result";
import { checkGoogleCalendarAvailabilityRateLimit } from "#convex/lib/rateLimits";
import {
	getDateAvailabilityRange,
	groupBusyDaysByMonth,
	groupBusyWindowsByDay,
	isTimeSlotAvailable,
	type BusyDayWindow
} from "#convex/lib/sessions/sessionCalendarTime";
import {
	createPackageCalendarEvent,
	getPackageCalendarSyncErrorReason,
	updatePackageCalendarEvent,
	type PackageCalendarDetails,
	type PackageCalendarSyncError,
	type PackageCalendarWriteError
} from "#convex/lib/packages/packageSchedulingCalendar";
import {
	deleteSessionCalendarEvent,
	type SessionCalendarEventRecord
} from "#convex/lib/sessions/sessionCalendarEvents";
import { formatDateValue, startOfToday } from "#studio/lib/bookingdatetime";

export type {
	PackageCalendarDetails,
	PackageCalendarWriteError
} from "#convex/lib/packages/packageSchedulingCalendar";

type PackageAvailabilityError =
	| ValidPackageByTokenError
	| {
			reason:
				| "BOOKING_INVALID_DATE"
				| "BOOKING_INVALID_TIME"
				| "GOOGLE_CALENDAR_AVAILABILITY_FAILED"
				| "GOOGLE_CALENDAR_AUTH_FAILED"
				| "GOOGLE_CALENDAR_RATE_LIMITED"
				| "INVALID_ZONED_TIME";
	  };

function loadPackageAvailabilityContext(
	ctx: ActionCtx,
	args: { rateLimitKey: string; token: string }
) {
	return fromConvexTuple(
		ctx.runQuery(internal.packageScheduling.getValidPackageByToken, {
			now: Date.now(),
			token: args.token
		})
	)
		.andThen((packageFromDb) =>
			checkGoogleCalendarAvailabilityRateLimit(ctx, args.rateLimitKey).map(() => packageFromDb)
		)
		.andThen((packageFromDb) =>
			loadGoogleCalendarClient("GOOGLE_CALENDAR_AVAILABILITY_FAILED").map((client) => ({
				client,
				packageFromDb
			}))
		)
		.andThen(({ client, packageFromDb }) => {
			const startDate = formatDateValue(startOfToday());
			const endDate = formatDateValue(new Date(packageFromDb.expiresAt));

			return getDateAvailabilityRange(startDate, endDate, client.timeZone).map(
				(availabilityRange) => ({ availabilityRange, client, packageFromDb })
			);
		});
}

function fetchPackageBusyWindows(context: {
	availabilityRange: { timeMax: string; timeMin: string };
	client: {
		calendar: Parameters<typeof getBusyWindowsInRange>[0]["calendar"];
		calendarIds: string[];
		timeZone: string;
	};
	packageFromDb: { expiresAt: number };
}) {
	return calendarResultAsync(
		getBusyWindowsInRange({
			calendar: context.client.calendar,
			calendarIds: context.client.calendarIds,
			timeMax: context.availabilityRange.timeMax,
			timeMin: context.availabilityRange.timeMin,
			timeZone: context.client.timeZone
		}),
		"GOOGLE_CALENDAR_AVAILABILITY_FAILED"
	).map((busyWindows) => ({
		busyWindows,
		client: context.client,
		packageFromDb: context.packageFromDb
	}));
}

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
	return loadPackageAvailabilityContext(ctx, args)
		.andThen((context) => fetchPackageBusyWindows(context))
		.andThen(({ busyWindows, client, packageFromDb }) =>
			groupBusyWindowsByDay(busyWindows, client.timeZone).map((busyDays) => ({
				busyWindowsByMonth: groupBusyDaysByMonth(busyDays),
				packageExpiresAt: packageFromDb.expiresAt,
				timeZone: client.timeZone
			}))
		);
}

function ensurePackageSlotAvailable(args: {
	session: SessionCalendarEventRecord | null;
	details: PackageCalendarDetails;
}) {
	return loadGoogleCalendarClient("GOOGLE_CALENDAR_SYNC_FAILED").andThen((client) => {
		const ignoredEvent = args.session
			? { calendarId: args.session.googleCalendarId, eventId: args.session.googleEventId }
			: undefined;

		return calendarResultAsync(
			getBusyWindows({
				calendar: client.calendar,
				calendarIds: client.calendarIds,
				date: args.details.date,
				ignoredEvent,
				timeZone: client.timeZone
			}),
			"GOOGLE_CALENDAR_SYNC_FAILED"
		).andThen((busyWindows) => {
			const isAvailable = isTimeSlotAvailable({
				busyWindows,
				date: args.details.date,
				duration: args.details.duration,
				eventBufferMinutes: args.details.eventBufferMinutes,
				time: args.details.time,
				timeZone: client.timeZone
			});

			return isAvailable ? ok(client) : err({ reason: "BOOKING_TIME_UNAVAILABLE" as const });
		});
	});
}

export function savePackageSessionCalendarEventService(args: {
	session: SessionCalendarEventRecord | null;
	details: PackageCalendarDetails;
}): ResultAsync<{ googleCalendarId?: string; googleEventId?: string }, PackageCalendarWriteError> {
	return ensurePackageSlotAvailable(args).andThen((client) =>
		args.session
			? updatePackageCalendarEvent(client, args.session, args.details)
			: createPackageCalendarEvent(client, args.details)
	);
}

export function deletePackageSessionCalendarEventService(
	session: SessionCalendarEventRecord
): ResultAsync<{ calendarEventDeleted: boolean }, PackageCalendarSyncError> {
	return (
		loadGoogleCalendarClient("GOOGLE_CALENDAR_SYNC_FAILED")
			// Delete the saved event, including declined invitations found by session details.
			.andThen(({ calendar, calendarId, timeZone }) =>
				deleteSessionCalendarEvent({ session, client: { calendar, calendarId, timeZone } }).mapErr(
					(error): PackageCalendarSyncError => ({
						reason: getPackageCalendarSyncErrorReason(error.reason)
					})
				)
			)
	);
}
