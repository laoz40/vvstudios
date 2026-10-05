"use node";

import { err, ok, ResultAsync } from "neverthrow";
import { getBusyWindows } from "#convex/lib/googleCalendar/googleCalendarAvailability";
import { loadGoogleCalendarClient } from "#convex/lib/googleCalendar/googleCalendarClient";
import {
	calendarErrorSchema,
	mapCalendarErrorCode
} from "#convex/lib/googleCalendar/googleCalendarErrors";
import { tryPromise } from "#convex/lib/result";
import { isTimeSlotAvailable } from "#convex/lib/sessions/sessionCalendarTime";
import { getGoogleCalendarClient } from "#convex/lib/googleCalendar/googleCalendarClient";
import type {
	SessionCalendarEventDetails,
	SessionCalendarEventRecord as PackageSessionCalendarEventRecord
} from "#convex/lib/sessions/sessionCalendarEventPayload";
import {
	createSessionCalendarEvent,
	deleteSessionCalendarEvent,
	updateSessionCalendarEventTiming
} from "#convex/services/googleCalendar/sessionCalendarEvent";
import { pickBookingAddonQuantities } from "#studio/features/booking-form/lib/booking-form-model";

export type SessionCalendarEventRecord = PackageSessionCalendarEventRecord;

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

export function loadPackageCalendarClientWhenSlotOpen(args: {
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

export function writePackageSessionGoogleCalendarEvent(
	client: PackageCalendarClient,
	args: { session: SessionCalendarEventRecord | null; details: PackageCalendarDetails }
): ResultAsync<{ googleCalendarId?: string; googleEventId?: string }, PackageCalendarWriteError> {
	return args.session
		? updatePackageCalendarEvent(client, args.session, args.details)
		: createPackageCalendarEvent(client, args.details);
}

export function syncPackageSessionGoogleCalendarEvent(args: {
	session: SessionCalendarEventRecord | null;
	details: PackageCalendarDetails;
}) {
	return loadPackageCalendarClientWhenSlotOpen(args).andThen((client) =>
		writePackageSessionGoogleCalendarEvent(client, args)
	);
}

export function removePackageSessionGoogleCalendarEvent(
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
