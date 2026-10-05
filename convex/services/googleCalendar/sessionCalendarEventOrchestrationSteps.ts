"use node";

import type { calendar_v3 } from "googleapis/build/src/apis/calendar/v3";
import { okAsync, type ResultAsync } from "neverthrow";
import { mapCalendarEventDeletedStep } from "#convex/lib/sessions/sessionCalendarEventPayload";
import { deleteGoogleCalendarEventIfFound } from "#convex/lib/googleCalendar/googleCalendarEventCalls";
import type {
	GoogleCalendarEventClient,
	SessionCalendarEventDetails,
	SessionCalendarEventRecord
} from "#convex/lib/sessions/sessionCalendarEventPayload";
import type {
	GoogleCalendarDeleteError,
	GoogleCalendarTimingMutationError
} from "#convex/lib/googleCalendar/googleCalendarEventCalls";

type SessionCalendarTimingUpdateError = GoogleCalendarTimingMutationError;

type SessionCalendarTimingUpdateResult = {
	googleCalendarId?: string;
	googleEventId?: string;
	outcome?: "replacementCreated";
};

export function deleteFoundSessionEventStep(
	client: GoogleCalendarEventClient,
	calendarId: string,
	foundEventId: string
) {
	return deleteGoogleCalendarEventIfFound(client.calendar, calendarId, foundEventId).map(
		mapCalendarEventDeletedStep
	);
}

export function deleteSessionEventAfterLookupStep(args: {
	client: GoogleCalendarEventClient;
	calendarId: string;
}) {
	return (foundEvent: calendar_v3.Schema$Event | null) => {
		const foundEventId = foundEvent?.id ?? null;

		if (!foundEventId) {
			return okAsync({ calendarEventDeleted: false });
		}

		return deleteFoundSessionEventStep(args.client, args.calendarId, foundEventId);
	};
}

export function deleteSavedEventOrLookupStep(args: {
	deleteSessionEventAfterLookup: (lookupArgs: {
		session: SessionCalendarEventRecord;
		client: GoogleCalendarEventClient;
		calendarId: string;
	}) => ResultAsync<{ calendarEventDeleted: boolean }, GoogleCalendarDeleteError>;
	session: SessionCalendarEventRecord;
	client: GoogleCalendarEventClient;
	calendarId: string;
}) {
	return (wasDeleted: boolean) =>
		wasDeleted
			? okAsync({ calendarEventDeleted: true })
			: args.deleteSessionEventAfterLookup({
					session: args.session,
					client: args.client,
					calendarId: args.calendarId
				});
}

export function updateExistingGoogleEventStep(args: {
	eventUpdateArgs: {
		client: GoogleCalendarEventClient;
		date: string;
		details: SessionCalendarEventDetails;
		googleCalendarId: string;
		googleEventId: string;
		time: string;
	};
	insertSessionCalendarEvent: (insertArgs: {
		client: GoogleCalendarEventClient;
		date: string;
		details: SessionCalendarEventDetails;
		googleCalendarId: string;
		googleEventId: string;
		time: string;
	}) => ResultAsync<SessionCalendarTimingUpdateResult, SessionCalendarTimingUpdateError>;
	patchExistingSessionCalendarEvent: (patchArgs: {
		client: GoogleCalendarEventClient;
		date: string;
		details: SessionCalendarEventDetails;
		googleCalendarId: string;
		googleEventId: string;
		time: string;
	}) => ResultAsync<SessionCalendarTimingUpdateResult, SessionCalendarTimingUpdateError>;
}) {
	return (existingGoogleEvent: { data: { status?: string | null } }) =>
		existingGoogleEvent.data.status === "cancelled"
			? args.insertSessionCalendarEvent(args.eventUpdateArgs)
			: args.patchExistingSessionCalendarEvent(args.eventUpdateArgs);
}
