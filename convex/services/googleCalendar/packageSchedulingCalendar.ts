"use node";

import { err, ok, ResultAsync } from "neverthrow";
import { internal } from "#convex/_generated/api";
import type { ActionCtx } from "#convex/_generated/server";
import {
	getBusyWindows,
	getBusyWindowsInRange
} from "#convex/lib/googleCalendar/googleCalendarAvailability";
import { loadGoogleCalendarClient } from "#convex/lib/googleCalendar/googleCalendarClient";
import {
	calendarErrorSchema,
	mapCalendarErrorCode
} from "#convex/lib/googleCalendar/googleCalendarErrors";
import { tryPromise } from "#convex/lib/result";
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
import { getGoogleCalendarClient } from "#convex/lib/googleCalendar/googleCalendarClient";
import type {
	SessionCalendarEventDetails,
	SessionCalendarEventRecord
} from "#convex/lib/sessions/sessionCalendarEventPayload";
import {
	createSessionCalendarEvent,
	deleteSessionCalendarEvent,
	updateSessionCalendarEventTiming
} from "#convex/services/googleCalendar/sessionCalendarEventWorkflow";
import { pickBookingAddonQuantities } from "#studio/features/booking-form/lib/booking-form-model";
import { formatDateValue, startOfToday } from "#studio/lib/bookingdatetime";

export type PackageCalendarDetails = SessionCalendarEventDetails & {
	date: string;
	eventBufferMinutes: number;
	time: string;
};

type PackageCalendarClient = Pick<
	ReturnType<typeof getGoogleCalendarClient>,
	"calendar" | "calendarId" | "timeZone"
>;

export type PackageCalendarSyncError =
	| { reason: "GOOGLE_CALENDAR_AUTH_FAILED" }
	| { reason: "GOOGLE_CALENDAR_RATE_LIMITED" }
	| { reason: "GOOGLE_CALENDAR_SYNC_FAILED" };

export type PackageCalendarWriteError =
	| { reason: "BOOKING_TIME_UNAVAILABLE" }
	| PackageCalendarSyncError;

type PackageCalendarIdPatch = Pick<
	SessionCalendarEventRecord,
	"googleCalendarId" | "googleEventId"
>;

function getPackageCalendarSyncErrorReason(reason: string): PackageCalendarSyncError["reason"] {
	if (reason === "GOOGLE_CALENDAR_AUTH_FAILED") return "GOOGLE_CALENDAR_AUTH_FAILED";

	if (reason === "GOOGLE_CALENDAR_RATE_LIMITED") return "GOOGLE_CALENDAR_RATE_LIMITED";

	return "GOOGLE_CALENDAR_SYNC_FAILED";
}

function updatePackageCalendarEvent(
	client: PackageCalendarClient,
	session: SessionCalendarEventRecord,
	details: PackageCalendarDetails
) {
	return updateSessionCalendarEventTiming({
		session,
		client,
		createMissingEvent: true,
		date: details.date,
		details: {
			addons: details.addons,
			duration: details.duration,
			email: details.email,
			name: details.name,
			service: details.service,
			...pickBookingAddonQuantities(details)
		},
		time: details.time
	})
		.mapErr(
			(error): PackageCalendarWriteError => ({
				reason: getPackageCalendarSyncErrorReason(error.reason)
			})
		)
		.map((result) => {
			const googleCalendarId = result.googleCalendarId ?? session.googleCalendarId;
			const googleEventId = result.googleEventId ?? session.googleEventId;
			const patch: PackageCalendarIdPatch = {};

			if (googleCalendarId) {
				patch.googleCalendarId = googleCalendarId;
			}

			if (googleEventId) {
				patch.googleEventId = googleEventId;
			}

			return patch;
		});
}

function createPackageCalendarEvent(
	client: PackageCalendarClient,
	details: PackageCalendarDetails
) {
	return createSessionCalendarEvent({
		client,
		date: details.date,
		details: {
			addons: details.addons,
			duration: details.duration,
			email: details.email,
			name: details.name,
			service: details.service,
			...pickBookingAddonQuantities(details)
		},
		time: details.time
	})
		.mapErr(
			(error): PackageCalendarWriteError => ({
				reason: getPackageCalendarSyncErrorReason(error.reason)
			})
		)
		.map((result) => {
			const patch: PackageCalendarIdPatch = {};

			if (result.googleCalendarId) {
				patch.googleCalendarId = result.googleCalendarId;
			}

			if (result.googleEventId) {
				patch.googleEventId = result.googleEventId;
			}

			return patch;
		});
}

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
	return tryPromise({
		try: () =>
			getBusyWindowsInRange({
				calendar: context.client.calendar,
				calendarIds: context.client.calendarIds,
				timeMax: context.availabilityRange.timeMax,
				timeMin: context.availabilityRange.timeMin,
				timeZone: context.client.timeZone
			}),
		catch: (error) => {
			const parsedError = calendarErrorSchema.safeParse(error);

			return {
				reason: parsedError.success
					? mapCalendarErrorCode(parsedError.data, "GOOGLE_CALENDAR_AVAILABILITY_FAILED")
					: "GOOGLE_CALENDAR_AVAILABILITY_FAILED"
			};
		}
	}).map((busyWindows) => ({
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

		return tryPromise({
			try: () =>
				getBusyWindows({
					calendar: client.calendar,
					calendarIds: client.calendarIds,
					date: args.details.date,
					ignoredEvent,
					timeZone: client.timeZone
				}),
			catch: (error) => {
				const parsedError = calendarErrorSchema.safeParse(error);

				return {
					reason: parsedError.success
						? mapCalendarErrorCode(parsedError.data, "GOOGLE_CALENDAR_SYNC_FAILED")
						: "GOOGLE_CALENDAR_SYNC_FAILED"
				};
			}
		}).andThen((busyWindows) => {
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
