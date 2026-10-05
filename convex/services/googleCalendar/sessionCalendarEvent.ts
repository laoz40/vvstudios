"use node";

import type { calendar_v3 } from "googleapis/build/src/apis/calendar/v3";
import { errAsync, okAsync, type ResultAsync } from "neverthrow";
import {
	deleteGoogleCalendarEventIfFound,
	getGoogleCalendarEvent,
	insertGoogleCalendarEvent,
	listGoogleCalendarEventsInWindow,
	patchGoogleCalendarEvent,
	type GoogleCalendarDeleteError,
	type GoogleCalendarEventMissing,
	type GoogleCalendarTimingMutationError
} from "#convex/lib/googleCalendar/googleCalendarEventCalls";
import {
	buildSessionCalendarEventPayload,
	mapInsertedSessionCalendarEventStep,
	matchingSessionCalendarEventStep,
	type GoogleCalendarEventClient,
	type SessionCalendarEventDetails,
	type SessionCalendarEventRecord
} from "#convex/lib/sessions/sessionCalendarEventPayload";
import { buildEventWindow } from "#convex/lib/sessions/sessionCalendarTime";
import {
	deleteSessionEventAfterLookupStep,
	deleteSavedEventOrLookupStep,
	updateExistingGoogleEventStep
} from "#convex/services/googleCalendar/sessionCalendarEventOrchestrationSteps";

export type { GoogleCalendarDeleteError as DeleteSessionCalendarEventError };

export type SessionCalendarTimingUpdateError = GoogleCalendarTimingMutationError;

export type SessionCalendarTimingUpdateResult = {
	googleCalendarId?: string;
	googleEventId?: string;
	outcome?: "replacementCreated";
};

function isMissingGoogleCalendarEvent(
	value: GoogleCalendarEventMissing | SessionCalendarTimingUpdateError
): value is GoogleCalendarEventMissing {
	return "kind" in value;
}

function findDeclinedSessionCalendarEvent({
	session,
	calendar,
	calendarId,
	timeZone
}: {
	session: SessionCalendarEventRecord;
	calendar: Pick<calendar_v3.Calendar, "events">;
	calendarId: string;
	timeZone: string;
}) {
	const eventWindowResult = buildEventWindow(
		session.date,
		session.time,
		session.duration,
		timeZone
	);

	if (eventWindowResult.isErr()) {
		return errAsync({ reason: "GOOGLE_CALENDAR_DELETE_FAILED" as const });
	}

	const { startDateTime, endDateTime } = eventWindowResult.value;

	return listGoogleCalendarEventsInWindow({
		calendar,
		calendarId,
		timeMax: endDateTime,
		timeMin: startDateTime
	}).map(matchingSessionCalendarEventStep(session));
}

function deleteSessionEventAfterLookup({
	session,
	client,
	calendarId
}: {
	session: SessionCalendarEventRecord;
	client: GoogleCalendarEventClient;
	calendarId: string;
}) {
	return findDeclinedSessionCalendarEvent({
		session,
		calendar: client.calendar,
		calendarId,
		timeZone: client.timeZone
	}).andThen(deleteSessionEventAfterLookupStep({ client, calendarId }));
}

export function deleteSessionCalendarEvent({
	session,
	client
}: {
	session: SessionCalendarEventRecord;
	client: GoogleCalendarEventClient;
}): ResultAsync<{ calendarEventDeleted: boolean }, GoogleCalendarDeleteError> {
	const calendarId = session.googleCalendarId ?? client.calendarId;
	const savedEventId = session.googleEventId ?? null;

	if (!savedEventId) {
		return deleteSessionEventAfterLookup({ session, client, calendarId });
	}

	return deleteGoogleCalendarEventIfFound(client.calendar, calendarId, savedEventId).andThen(
		deleteSavedEventOrLookupStep({ session, client, calendarId, deleteSessionEventAfterLookup })
	);
}

function insertSessionCalendarEvent({
	client,
	date,
	details,
	time
}: {
	client: GoogleCalendarEventClient;
	date: string;
	details: SessionCalendarEventDetails;
	time: string;
}) {
	const payloadResult = buildSessionCalendarEventPayload({
		date,
		details,
		time,
		timeZone: client.timeZone
	});

	if (payloadResult.isErr()) {
		return errAsync({ reason: "GOOGLE_CALENDAR_CREATE_FAILED" as const });
	}

	return insertGoogleCalendarEvent({
		calendar: client.calendar,
		calendarId: client.calendarId,
		requestBody: payloadResult.value
	}).map(mapInsertedSessionCalendarEventStep(client));
}

export function createSessionCalendarEvent({
	client,
	date,
	details,
	time
}: {
	client: GoogleCalendarEventClient;
	date: string;
	details: SessionCalendarEventDetails;
	time: string;
}): ResultAsync<SessionCalendarTimingUpdateResult, SessionCalendarTimingUpdateError> {
	return insertSessionCalendarEvent({ client, date, details, time });
}

function emptySessionCalendarTimingUpdateStep(): SessionCalendarTimingUpdateResult {
	return {};
}

function recoverMissingEventOnPatchStep(args: {
	client: GoogleCalendarEventClient;
	date: string;
	details: SessionCalendarEventDetails;
	time: string;
}) {
	return (patchError: GoogleCalendarEventMissing | SessionCalendarTimingUpdateError) =>
		isMissingGoogleCalendarEvent(patchError)
			? insertSessionCalendarEvent(args)
			: errAsync(patchError);
}

function patchExistingSessionCalendarEvent({
	client,
	date,
	details,
	googleCalendarId,
	googleEventId,
	time
}: {
	client: GoogleCalendarEventClient;
	date: string;
	details: SessionCalendarEventDetails;
	googleCalendarId: string;
	googleEventId: string;
	time: string;
}) {
	const payloadResult = buildSessionCalendarEventPayload({
		date,
		details,
		time,
		timeZone: client.timeZone
	});

	if (payloadResult.isErr()) {
		return errAsync({ reason: "GOOGLE_CALENDAR_UPDATE_FAILED" as const });
	}

	return patchGoogleCalendarEvent({
		calendar: client.calendar,
		calendarId: googleCalendarId,
		eventId: googleEventId,
		requestBody: payloadResult.value
	})
		.map(emptySessionCalendarTimingUpdateStep)
		.orElse(recoverMissingEventOnPatchStep({ client, date, details, time }));
}

function recoverMissingEventOnLookupStep(args: {
	client: GoogleCalendarEventClient;
	date: string;
	details: SessionCalendarEventDetails;
	time: string;
}) {
	return (lookupError: GoogleCalendarEventMissing | SessionCalendarTimingUpdateError) =>
		isMissingGoogleCalendarEvent(lookupError)
			? insertSessionCalendarEvent(args)
			: errAsync(lookupError);
}

export function updateSessionCalendarEventTiming({
	session,
	client,
	date,
	details,
	time,
	createMissingEvent = false
}: {
	session: SessionCalendarEventRecord;
	client: GoogleCalendarEventClient;
	date: string;
	details: SessionCalendarEventDetails;
	time: string;
	createMissingEvent?: boolean;
}): ResultAsync<SessionCalendarTimingUpdateResult, SessionCalendarTimingUpdateError> {
	// Some reschedulable failed bookings never created a Google event in the original flow.
	// When requested, create that missing event before saving the new session time.
	if (!session.googleEventId || !session.googleCalendarId) {
		if (createMissingEvent) {
			return insertSessionCalendarEvent({ client, date, details, time });
		}

		return okAsync({});
	}

	const googleCalendarId = session.googleCalendarId;
	const googleEventId = session.googleEventId;

	const eventUpdateArgs = { client, date, details, googleCalendarId, googleEventId, time };

	return getGoogleCalendarEvent({
		calendar: client.calendar,
		calendarId: googleCalendarId,
		eventId: googleEventId
	})
		.andThen(
			updateExistingGoogleEventStep({
				eventUpdateArgs,
				insertSessionCalendarEvent,
				patchExistingSessionCalendarEvent
			})
		)
		.orElse(recoverMissingEventOnLookupStep({ client, date, details, time }));
}
