"use node";

import { ok, safeTry, type ResultAsync } from "neverthrow";
import {
	type GoogleCalendarDeleteError,
	type GoogleCalendarEventMissing,
	type GoogleCalendarTimingMutationError
} from "#convex/googleCalendar/lib/googleCalendarEventCalls";
import {
	deleteFoundEvent,
	deleteSavedCalendarEventIfFound,
	findDeclinedSessionCalendarEvent,
	insertCalendarEvent,
	insertCalendarEventWhenMissing,
	loadSavedCalendarEventForUpdate,
	updateCalendarEventForExisting
} from "#convex/googleCalendar/lib/calendarEventSteps";
import type {
	GoogleCalendarEventClient,
	SessionCalendarEventDetails,
	SessionCalendarEventRecord
} from "#convex/sessions/lib/calendarEventPayload";
import type { SessionCalendarTimingUpdateResult as CalendarTimingUpdateResult } from "#convex/googleCalendar/lib/calendarEventSteps";

export type { GoogleCalendarDeleteError as DeleteSessionCalendarEventError };

export type SessionCalendarTimingUpdateError = GoogleCalendarTimingMutationError;

export type SessionCalendarTimingUpdateResult = CalendarTimingUpdateResult;

export function deleteSessionCalendarEvent(args: {
	session: SessionCalendarEventRecord;
	client: GoogleCalendarEventClient;
}): ResultAsync<{ calendarEventDeleted: boolean }, GoogleCalendarDeleteError> {
	const calendarId = args.session.googleCalendarId ?? args.client.calendarId;
	const savedEventId = args.session.googleEventId ?? null;

	return safeTry(async function* () {
		const wasDeleted = yield* deleteSavedCalendarEventIfFound(
			args.client,
			calendarId,
			savedEventId
		);

		const foundEvent = yield* findDeclinedSessionCalendarEvent({
			session: args.session,
			calendar: args.client.calendar,
			calendarId,
			timeZone: args.client.timeZone,
			skipLookup: wasDeleted
		});

		const result = yield* deleteFoundEvent(args.client, calendarId, foundEvent, wasDeleted);

		return ok(result);
	});
}

export function createSessionCalendarEvent(args: {
	client: GoogleCalendarEventClient;
	date: string;
	details: SessionCalendarEventDetails;
	time: string;
}): ResultAsync<SessionCalendarTimingUpdateResult, SessionCalendarTimingUpdateError> {
	return insertCalendarEvent(args);
}

function updateSavedCalendarEvent(args: {
	client: GoogleCalendarEventClient;
	date: string;
	details: SessionCalendarEventDetails;
	time: string;
	googleCalendarId?: string;
	googleEventId?: string;
	createMissingEvent?: boolean;
}) {
	return safeTry(async function* () {
		const savedEvent = yield* loadSavedCalendarEventForUpdate(args);

		const result = yield* updateCalendarEventForExisting(
			args,
			savedEvent,
			args.createMissingEvent ?? false
		);

		return ok(result);
	}).orElse((error: GoogleCalendarEventMissing | SessionCalendarTimingUpdateError) =>
		insertCalendarEventWhenMissing(args, error)
	);
}

export function updateSessionCalendarEventTiming(args: {
	session: SessionCalendarEventRecord | null;
	client: GoogleCalendarEventClient;
	date: string;
	details: SessionCalendarEventDetails;
	time: string;
	createMissingEvent?: boolean;
}): ResultAsync<SessionCalendarTimingUpdateResult, SessionCalendarTimingUpdateError> {
	return updateSavedCalendarEvent({
		...args,
		googleCalendarId: args.session?.googleCalendarId,
		googleEventId: args.session?.googleEventId
	});
}
