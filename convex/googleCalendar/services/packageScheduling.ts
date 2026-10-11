"use node";

import type { ResultAsync } from "neverthrow";
import { loadGoogleCalendarClient } from "#convex/googleCalendar/lib/googleCalendarClient";
import type { GoogleCalendarWriteError } from "#convex/googleCalendar/lib/googleCalendarErrors";
import type { PackageCalendarDetails } from "#convex/googleCalendar/lib/packageDetails";
import {
	loadPackageBusyWindows,
	packageCalendarIdPatchFromUpdate,
	packageCalendarEventDetails,
	packageSlotAvailabilityResult
} from "#convex/googleCalendar/lib/packageScheduling";
import type { getGoogleCalendarClient } from "#convex/googleCalendar/lib/googleCalendarClient";
import type { SessionCalendarEventRecord as PackageSessionCalendarEventRecord } from "#convex/sessions/lib/calendarEventPayload";
import {
	deleteSessionCalendarEvent,
	updateSessionCalendarEventTiming
} from "#convex/googleCalendar/services/calendarEvent";

export type SessionCalendarEventRecord = PackageSessionCalendarEventRecord;

type PackageCalendarClient = Pick<
	ReturnType<typeof getGoogleCalendarClient>,
	"calendar" | "calendarId" | "calendarIds" | "timeZone"
>;

export type PackageCalendarWriteError =
	| { reason: "BOOKING_TIME_UNAVAILABLE" }
	| GoogleCalendarWriteError;

function openPackageCalendarSlot(
	args: { session: SessionCalendarEventRecord | null; details: PackageCalendarDetails },
	client: PackageCalendarClient
) {
	return loadPackageBusyWindows(client, args.details, args.session).andThen((busyWindows) =>
		packageSlotAvailabilityResult(client, args.details, busyWindows)
	);
}

export function loadPackageCalendarClientWhenSlotOpen(args: {
	session: SessionCalendarEventRecord | null;
	details: PackageCalendarDetails;
}) {
	return loadGoogleCalendarClient("GOOGLE_CALENDAR_SYNC_FAILED").andThen(
		(client: PackageCalendarClient) => openPackageCalendarSlot(args, client)
	);
}

export function writePackageSessionGoogleCalendarEvent(
	client: PackageCalendarClient,
	args: { session: SessionCalendarEventRecord | null; details: PackageCalendarDetails }
): ResultAsync<{ googleCalendarId?: string; googleEventId?: string }, PackageCalendarWriteError> {
	return updateSessionCalendarEventTiming({
		session: args.session,
		client,
		createMissingEvent: true,
		date: args.details.date,
		details: packageCalendarEventDetails(args.details),
		time: args.details.time
	}).map((result: { googleCalendarId?: string; googleEventId?: string }) =>
		packageCalendarIdPatchFromUpdate(args.session, result)
	);
}

export function syncPackageSessionGoogleCalendarEvent(args: {
	session: SessionCalendarEventRecord | null;
	details: PackageCalendarDetails;
}) {
	return loadPackageCalendarClientWhenSlotOpen(args).andThen((client: PackageCalendarClient) =>
		writePackageSessionGoogleCalendarEvent(client, args)
	);
}

export function removePackageSessionGoogleCalendarEvent(
	session: SessionCalendarEventRecord
): ResultAsync<{ calendarEventDeleted: boolean }, GoogleCalendarWriteError> {
	return loadGoogleCalendarClient("GOOGLE_CALENDAR_SYNC_FAILED").andThen((client) =>
		deleteSessionCalendarEvent({
			session,
			client: {
				calendar: client.calendar,
				calendarId: client.calendarId,
				timeZone: client.timeZone
			}
		})
	);
}
