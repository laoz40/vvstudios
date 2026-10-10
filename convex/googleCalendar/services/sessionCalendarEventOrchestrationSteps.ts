"use node";

import type { calendar_v3 } from "googleapis/build/src/apis/calendar/v3";
import { okAsync, type ResultAsync } from "neverthrow";
import { deleteGoogleCalendarEventIfFound } from "#convex/googleCalendar/lib/googleCalendarEventCalls";
import type {
	GoogleCalendarEventClient,
	SessionCalendarEventDetails,
	SessionCalendarEventRecord
} from "#convex/sessions/lib/sessionCalendarEventPayload";
import type {
	GoogleCalendarDeleteError,
	GoogleCalendarTimingMutationError
} from "#convex/googleCalendar/lib/googleCalendarEventCalls";

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
		(wasFoundEventDeleted) => ({ calendarEventDeleted: wasFoundEventDeleted })
	);
}

export function deleteSessionEventAfterLookupStep(
	args: { client: GoogleCalendarEventClient; calendarId: string },
	foundEvent: calendar_v3.Schema$Event | null
) {
	const foundEventId = foundEvent?.id ?? null;

	if (!foundEventId) {
		return okAsync({ calendarEventDeleted: false });
	}

	return deleteFoundSessionEventStep(args.client, args.calendarId, foundEventId);
}

export function deleteSavedEventOrLookupStep(
	args: {
		deleteSessionEventAfterLookup: (lookupArgs: {
			session: SessionCalendarEventRecord;
			client: GoogleCalendarEventClient;
			calendarId: string;
		}) => ResultAsync<{ calendarEventDeleted: boolean }, GoogleCalendarDeleteError>;
		session: SessionCalendarEventRecord;
		client: GoogleCalendarEventClient;
		calendarId: string;
	},
	wasDeleted: boolean
) {
	return wasDeleted
		? okAsync({ calendarEventDeleted: true })
		: args.deleteSessionEventAfterLookup({
				session: args.session,
				client: args.client,
				calendarId: args.calendarId
			});
}

export function updateExistingGoogleEventStep(
	args: {
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
	},
	existingGoogleEvent: { data: { status?: string | null } }
) {
	return existingGoogleEvent.data.status === "cancelled"
		? args.insertSessionCalendarEvent(args.eventUpdateArgs)
		: args.patchExistingSessionCalendarEvent(args.eventUpdateArgs);
}
