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
	isMatchingSessionCalendarEvent,
	type GoogleCalendarEventClient,
	type SessionCalendarEventDetails,
	type SessionCalendarEventRecord
} from "#convex/lib/sessions/sessionCalendarEventPayload";
import { buildEventWindow } from "#convex/lib/sessions/sessionCalendarTime";

export type { OrphanedSessionCalendarEventCleanupError } from "#convex/lib/googleCalendar/googleCalendarEventCalls";

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
	}).map(
		(events) => events.find((event) => isMatchingSessionCalendarEvent(event, session)) ?? null
	);
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
	}).andThen((foundEvent) => {
		const foundEventId = foundEvent?.id ?? null;

		if (!foundEventId) {
			return okAsync({ calendarEventDeleted: false });
		}

		return deleteGoogleCalendarEventIfFound(client.calendar, calendarId, foundEventId).map(
			(wasFoundEventDeleted) => ({ calendarEventDeleted: wasFoundEventDeleted })
		);
	});
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
		(wasDeleted) =>
			wasDeleted
				? okAsync({ calendarEventDeleted: true })
				: deleteSessionEventAfterLookup({ session, client, calendarId })
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
	}).map((replacementEvent) => ({
		googleCalendarId: client.calendarId,
		googleEventId: replacementEvent.data.id ?? undefined,
		outcome: "replacementCreated" as const
	}));
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
		.map(() => ({}) satisfies SessionCalendarTimingUpdateResult)
		.orElse((patchError) =>
			isMissingGoogleCalendarEvent(patchError)
				? insertSessionCalendarEvent({ client, date, details, time })
				: errAsync(patchError)
		);
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

	return getGoogleCalendarEvent({
		calendar: client.calendar,
		calendarId: googleCalendarId,
		eventId: googleEventId
	})
		.andThen((existingGoogleEvent) =>
			existingGoogleEvent.data.status === "cancelled"
				? insertSessionCalendarEvent({ client, date, details, time })
				: patchExistingSessionCalendarEvent({
						client,
						date,
						details,
						googleCalendarId,
						googleEventId,
						time
					})
		)
		.orElse((lookupError) =>
			isMissingGoogleCalendarEvent(lookupError)
				? insertSessionCalendarEvent({ client, date, details, time })
				: errAsync(lookupError)
		);
}
