import type { calendar_v3 } from "googleapis/build/src/apis/calendar/v3";
import { errAsync, okAsync, type ResultAsync } from "neverthrow";
import {
	deleteGoogleCalendarEventIfFound,
	getGoogleCalendarEvent,
	insertGoogleCalendarEvent,
	listGoogleCalendarEventsInWindow,
	patchGoogleCalendarEvent,
	type GoogleCalendarEventMissing,
	type GoogleCalendarDeleteError,
	type GoogleCalendarTimingMutationError
} from "#convex/googleCalendar/lib/googleCalendarEventCalls";
import {
	buildSessionCalendarEventPayload,
	matchingSessionCalendarEventStep,
	type GoogleCalendarEventClient,
	type SessionCalendarEventDetails,
	type SessionCalendarEventRecord
} from "#convex/sessions/lib/calendarEventPayload";
import { buildEventWindow } from "#convex/sessions/lib/calendarTime";

export type SessionCalendarTimingUpdateResult = {
	googleCalendarId?: string;
	googleEventId?: string;
	outcome?: "replacementCreated";
};

export function deleteFoundEvent(
	client: GoogleCalendarEventClient,
	calendarId: string,
	foundEvent: calendar_v3.Schema$Event | null,
	alreadyDeleted = false
) {
	const eventId = foundEvent?.id ?? null;

	if (alreadyDeleted) {
		return okAsync({ calendarEventDeleted: true });
	}

	return eventId
		? deleteGoogleCalendarEventIfFound(client.calendar, calendarId, eventId).map((deleted) => ({
				calendarEventDeleted: deleted
			}))
		: okAsync({ calendarEventDeleted: false });
}

export function deleteSavedCalendarEventIfFound(
	client: GoogleCalendarEventClient,
	calendarId: string,
	eventId: string | null
) {
	return eventId
		? deleteGoogleCalendarEventIfFound(client.calendar, calendarId, eventId)
		: okAsync(false);
}

export function insertCalendarEvent(args: {
	client: GoogleCalendarEventClient;
	date: string;
	details: SessionCalendarEventDetails;
	time: string;
}): ResultAsync<SessionCalendarTimingUpdateResult, GoogleCalendarTimingMutationError> {
	const payloadResult = buildSessionCalendarEventPayload({
		date: args.date,
		details: args.details,
		time: args.time,
		timeZone: args.client.timeZone
	});

	if (payloadResult.isErr()) {
		return errAsync({ reason: "GOOGLE_CALENDAR_CREATE_FAILED" as const });
	}

	return insertGoogleCalendarEvent({
		calendar: args.client.calendar,
		calendarId: args.client.calendarId,
		requestBody: payloadResult.value
	}).map((replacementEvent) => ({
		googleCalendarId: args.client.calendarId,
		googleEventId: replacementEvent.data.id ?? undefined,
		outcome: "replacementCreated" as const
	}));
}

export function patchCalendarEvent(args: {
	client: GoogleCalendarEventClient;
	date: string;
	details: SessionCalendarEventDetails;
	googleCalendarId: string;
	googleEventId: string;
	time: string;
}): ResultAsync<
	SessionCalendarTimingUpdateResult,
	GoogleCalendarEventMissing | GoogleCalendarTimingMutationError
> {
	const payloadResult = buildSessionCalendarEventPayload({
		date: args.date,
		details: args.details,
		time: args.time,
		timeZone: args.client.timeZone
	});

	if (payloadResult.isErr()) {
		return errAsync({ reason: "GOOGLE_CALENDAR_UPDATE_FAILED" as const });
	}

	return patchGoogleCalendarEvent({
		calendar: args.client.calendar,
		calendarId: args.googleCalendarId,
		eventId: args.googleEventId,
		requestBody: payloadResult.value
	}).map((): SessionCalendarTimingUpdateResult => ({}));
}

export function findDeclinedSessionCalendarEvent(args: {
	session: SessionCalendarEventRecord;
	calendar: Pick<calendar_v3.Calendar, "events">;
	calendarId: string;
	timeZone: string;
	skipLookup?: boolean;
}): ResultAsync<calendar_v3.Schema$Event | null, GoogleCalendarDeleteError> {
	if (args.skipLookup) {
		return okAsync(null);
	}

	const eventWindowResult = buildEventWindow(
		args.session.date,
		args.session.time,
		args.session.duration,
		args.timeZone
	);

	if (eventWindowResult.isErr()) {
		return errAsync({ reason: "GOOGLE_CALENDAR_DELETE_FAILED" as const });
	}

	return listGoogleCalendarEventsInWindow({
		calendar: args.calendar,
		calendarId: args.calendarId,
		timeMin: eventWindowResult.value.startDateTime,
		timeMax: eventWindowResult.value.endDateTime
	}).map((events) => matchingSessionCalendarEventStep(args.session, events));
}

export function loadSavedCalendarEventForUpdate(args: {
	client: GoogleCalendarEventClient;
	googleCalendarId?: string;
	googleEventId?: string;
}): ResultAsync<
	{ event: calendar_v3.Schema$Event; googleCalendarId: string; googleEventId: string } | null,
	GoogleCalendarEventMissing | GoogleCalendarTimingMutationError
> {
	if (!args.googleCalendarId || !args.googleEventId) {
		return okAsync(null);
	}

	const { googleCalendarId, googleEventId } = args;

	return getGoogleCalendarEvent({
		calendar: args.client.calendar,
		calendarId: googleCalendarId,
		eventId: googleEventId
	}).map((response) => ({ event: response.data, googleCalendarId, googleEventId }));
}

export function updateCalendarEventForExisting(
	args: {
		client: GoogleCalendarEventClient;
		date: string;
		details: SessionCalendarEventDetails;
		time: string;
	},
	savedEvent: {
		event: calendar_v3.Schema$Event;
		googleCalendarId: string;
		googleEventId: string;
	} | null,
	shouldCreateWhenMissing: boolean
) {
	if (!savedEvent) {
		return shouldCreateWhenMissing ? insertCalendarEvent(args) : okAsync({});
	}

	return savedEvent.event.status === "cancelled"
		? insertCalendarEvent(args)
		: patchCalendarEvent({
				...args,
				googleCalendarId: savedEvent.googleCalendarId,
				googleEventId: savedEvent.googleEventId
			});
}

export function insertCalendarEventWhenMissing(
	args: {
		client: GoogleCalendarEventClient;
		date: string;
		details: SessionCalendarEventDetails;
		time: string;
	},
	error: GoogleCalendarEventMissing | GoogleCalendarTimingMutationError
) {
	return "kind" in error ? insertCalendarEvent(args) : errAsync(error);
}
