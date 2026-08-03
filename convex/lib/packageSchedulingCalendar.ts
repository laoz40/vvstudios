"use node";

import { ResultAsync } from "neverthrow";
import { getGoogleCalendarClient } from "./googleCalendarClient";
import {
	createSessionCalendarEvent,
	updateSessionCalendarEventTiming,
	type SessionCalendarEventDetails,
	type SessionCalendarEventRecord
} from "./sessionCalendarEvents";

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

export function updatePackageCalendarEvent(
	client: PackageCalendarClient,
	session: SessionCalendarEventRecord,
	details: PackageCalendarDetails
) {
	return ResultAsync.fromSafePromise(
		updateSessionCalendarEventTiming({
			session,
			client,
			createMissingEvent: true,
			date: details.date,
			details: {
				addons: details.addons,
				duration: details.duration,
				email: details.email,
				name: details.name,
				service: details.service
			},
			time: details.time
		})
	)
		.andThen((result) => result)
		.mapErr(
			(error): PackageCalendarWriteError => ({
				reason: getPackageCalendarSyncErrorReason(error.reason)
			})
		)
		.map((result) => {
			const googleCalendarId = result.googleCalendarId ?? session.googleCalendarId;
			const googleEventId = result.googleEventId ?? session.googleEventId;

			return {
				...(googleCalendarId ? { googleCalendarId } : {}),
				...(googleEventId ? { googleEventId } : {})
			};
		});
}

export function createPackageCalendarEvent(
	client: PackageCalendarClient,
	details: PackageCalendarDetails
) {
	return ResultAsync.fromSafePromise(
		createSessionCalendarEvent({
			client,
			date: details.date,
			details: {
				addons: details.addons,
				duration: details.duration,
				email: details.email,
				name: details.name,
				service: details.service
			},
			time: details.time
		})
	)
		.andThen((result) => result)
		.mapErr(
			(error): PackageCalendarWriteError => ({
				reason: getPackageCalendarSyncErrorReason(error.reason)
			})
		)
		.map((result) => ({
			...(result.googleCalendarId ? { googleCalendarId: result.googleCalendarId } : {}),
			...(result.googleEventId ? { googleEventId: result.googleEventId } : {})
		}));
}

export function getPackageCalendarSyncErrorReason(
	reason: string
): PackageCalendarSyncError["reason"] {
	if (reason === "GOOGLE_CALENDAR_AUTH_FAILED") return "GOOGLE_CALENDAR_AUTH_FAILED";
	if (reason === "GOOGLE_CALENDAR_RATE_LIMITED") return "GOOGLE_CALENDAR_RATE_LIMITED";

	return "GOOGLE_CALENDAR_SYNC_FAILED";
}
