"use node";

import { err, ok, ResultAsync } from "neverthrow";
import { getBusyWindows } from "#convex/lib/googleCalendar/googleCalendarAvailability";
import { loadGoogleCalendarClient } from "#convex/lib/googleCalendar/googleCalendarClient";
import {
	tryGoogleCalendarAvailability,
	type GoogleCalendarWriteError
} from "#convex/lib/googleCalendar/googleCalendarErrors";
import { isTimeSlotAvailable } from "#convex/lib/sessions/sessionCalendarTime";
import { getGoogleCalendarClient } from "#convex/lib/googleCalendar/googleCalendarClient";
import type { PackageCalendarDetails } from "#convex/lib/googleCalendar/packageCalendarDetails";
import type { SessionCalendarEventRecord as PackageSessionCalendarEventRecord } from "#convex/lib/sessions/sessionCalendarEventPayload";
import {
	createSessionCalendarEvent,
	deleteSessionCalendarEvent,
	updateSessionCalendarEventTiming
} from "#convex/services/googleCalendar/sessionCalendarEvent";
import { pickBookingAddonQuantities } from "#studio/features/booking-form/lib/booking-form-model";

export type SessionCalendarEventRecord = PackageSessionCalendarEventRecord;

type PackageCalendarClient = Pick<
	ReturnType<typeof getGoogleCalendarClient>,
	"calendar" | "calendarId" | "calendarIds" | "timeZone"
>;

export type PackageCalendarWriteError =
	| { reason: "BOOKING_TIME_UNAVAILABLE" }
	| GoogleCalendarWriteError;

type PackageCalendarIdPatch = Pick<
	SessionCalendarEventRecord,
	"googleCalendarId" | "googleEventId"
>;

function packageCalendarIdPatchFromUpdateStep(
	session: SessionCalendarEventRecord,
	result: { googleCalendarId?: string; googleEventId?: string }
) {
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
}

function packageCalendarIdPatchFromCreateStep(result: {
	googleCalendarId?: string;
	googleEventId?: string;
}) {
	const patch: PackageCalendarIdPatch = {};

	if (result.googleCalendarId) {
		patch.googleCalendarId = result.googleCalendarId;
	}

	if (result.googleEventId) {
		patch.googleEventId = result.googleEventId;
	}

	return patch;
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
	}).map((result: { googleCalendarId?: string; googleEventId?: string }) =>
		packageCalendarIdPatchFromUpdateStep(session, result)
	);
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
	}).map((result: { googleCalendarId?: string; googleEventId?: string }) =>
		packageCalendarIdPatchFromCreateStep(result)
	);
}

function openPackageCalendarSlotStep(
	args: { session: SessionCalendarEventRecord | null; details: PackageCalendarDetails },
	client: PackageCalendarClient
) {
	const ignoredEvent = args.session
		? { calendarId: args.session.googleCalendarId, eventId: args.session.googleEventId }
		: undefined;

	return tryGoogleCalendarAvailability(() =>
		getBusyWindows({
			calendar: client.calendar,
			calendarIds: client.calendarIds,
			date: args.details.date,
			ignoredEvent,
			timeZone: client.timeZone
		})
	).andThen((busyWindows: Awaited<ReturnType<typeof getBusyWindows>>) =>
		confirmPackageSlotAvailableStep(args.details, client, busyWindows)
	);
}

function confirmPackageSlotAvailableStep(
	details: PackageCalendarDetails,
	client: PackageCalendarClient,
	busyWindows: Awaited<ReturnType<typeof getBusyWindows>>
) {
	const isAvailable = isTimeSlotAvailable({
		busyWindows,
		date: details.date,
		duration: details.duration,
		eventBufferMinutes: details.eventBufferMinutes,
		time: details.time,
		timeZone: client.timeZone
	});

	return isAvailable ? ok(client) : err({ reason: "BOOKING_TIME_UNAVAILABLE" as const });
}

export function loadPackageCalendarClientWhenSlotOpen(args: {
	session: SessionCalendarEventRecord | null;
	details: PackageCalendarDetails;
}) {
	return loadGoogleCalendarClient("GOOGLE_CALENDAR_SYNC_FAILED").andThen(
		(client: PackageCalendarClient) => openPackageCalendarSlotStep(args, client)
	);
}

function writePackageCalendarForClientStep(
	args: { session: SessionCalendarEventRecord | null; details: PackageCalendarDetails },
	client: PackageCalendarClient
) {
	return writePackageSessionGoogleCalendarEvent(client, args);
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
	return loadPackageCalendarClientWhenSlotOpen(args).andThen((client: PackageCalendarClient) =>
		writePackageCalendarForClientStep(args, client)
	);
}

function deletePackageSessionCalendarStep(
	session: SessionCalendarEventRecord,
	{
		calendar,
		calendarId,
		timeZone
	}: Pick<PackageCalendarClient, "calendar" | "calendarId" | "timeZone"> & { calendarIds: string[] }
) {
	return deleteSessionCalendarEvent({ session, client: { calendar, calendarId, timeZone } });
}

export function removePackageSessionGoogleCalendarEvent(
	session: SessionCalendarEventRecord
): ResultAsync<{ calendarEventDeleted: boolean }, GoogleCalendarWriteError> {
	return (
		loadGoogleCalendarClient("GOOGLE_CALENDAR_SYNC_FAILED")
			// Delete the saved event, including declined invitations found by session details.
			.andThen((_value) => deletePackageSessionCalendarStep(session, _value))
	);
}
