"use node";

import { ok, safeTry, type ResultAsync } from "neverthrow";
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
	return safeTry(async function* () {
		const busyWindows = yield* loadPackageBusyWindows(client, args.details, args.session);
		const result = yield* packageSlotAvailabilityResult(client, args.details, busyWindows);

		return ok(result);
	});
}

export function loadPackageCalendarClientWhenSlotOpen(args: {
	session: SessionCalendarEventRecord | null;
	details: PackageCalendarDetails;
}) {
	return safeTry(async function* () {
		const client = yield* loadGoogleCalendarClient("GOOGLE_CALENDAR_SYNC_FAILED");
		const result = yield* openPackageCalendarSlot(args, client);

		return ok(result);
	});
}

export function writePackageSessionGoogleCalendarEvent(
	client: PackageCalendarClient,
	args: { session: SessionCalendarEventRecord | null; details: PackageCalendarDetails }
): ResultAsync<{ googleCalendarId?: string; googleEventId?: string }, PackageCalendarWriteError> {
	return safeTry(async function* () {
		const update = yield* updateSessionCalendarEventTiming({
			session: args.session,
			client,
			createMissingEvent: true,
			date: args.details.date,
			details: packageCalendarEventDetails(args.details),
			time: args.details.time
		});

		return ok(packageCalendarIdPatchFromUpdate(args.session, update));
	});
}

export function syncPackageSessionGoogleCalendarEvent(args: {
	session: SessionCalendarEventRecord | null;
	details: PackageCalendarDetails;
}) {
	return safeTry(async function* () {
		const client = yield* loadPackageCalendarClientWhenSlotOpen(args);
		const result = yield* writePackageSessionGoogleCalendarEvent(client, args);

		return ok(result);
	});
}

export function removePackageSessionGoogleCalendarEvent(
	session: SessionCalendarEventRecord
): ResultAsync<{ calendarEventDeleted: boolean }, GoogleCalendarWriteError> {
	return safeTry(async function* () {
		const client = yield* loadGoogleCalendarClient("GOOGLE_CALENDAR_SYNC_FAILED");

		const result = yield* deleteSessionCalendarEvent({
			session,
			client: {
				calendar: client.calendar,
				calendarId: client.calendarId,
				timeZone: client.timeZone
			}
		});

		return ok(result);
	});
}
