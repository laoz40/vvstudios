"use node";

import type { calendar_v3 } from "googleapis/build/src/apis/calendar/v3";
import type { ResultAsync } from "neverthrow";
import type { Doc } from "#convex/_generated/dataModel";
import type { SessionCalendarEventDetails } from "#convex/sessions/lib/calendarEventPayload";
import {
	updateSessionCalendarEventTiming,
	type SessionCalendarTimingUpdateResult,
	type SessionCalendarTimingUpdateError
} from "#convex/googleCalendar/services/calendarEvent";
import type { SessionAvailabilitySettings } from "#convex/sessions/lib/calendarTime";
import {
	getSessionStartAt,
	validateSessionTimingEdit,
	type AdminSessionUpdateError
} from "#convex/sessions/lib/adminEdit";

type GoogleCalendarLike = Pick<calendar_v3.Calendar, "events">;

export interface AdminSessionGoogleCalendarClient {
	calendar: GoogleCalendarLike;
	calendarId: string;
	calendarIds: string[];
	timeZone: string;
}

type SessionTimingSyncArgs = {
	bypassAvailabilitySettings?: boolean;
	session: Doc<"bookings">;
	client: AdminSessionGoogleCalendarClient;
	date: string;
	details: SessionCalendarEventDetails;
	duration: string;
	createMissingEvent?: boolean;
	settings: SessionAvailabilitySettings;
	time: string;
};

function sessionTimingUpdateWithStartAtStep(
	sessionStartAt: number,
	calendarUpdate: SessionCalendarTimingUpdateResult
) {
	return { ...calendarUpdate, sessionStartAt };
}

function syncSessionTimingAfterValidationStep(
	args: SessionTimingSyncArgs & { sessionStartAt: number }
) {
	return updateSessionCalendarEventTiming({
		session: args.session,
		client: args.client,
		date: args.date,
		details: args.details,
		createMissingEvent: args.createMissingEvent,
		time: args.time
	}).map((calendarUpdate: SessionCalendarTimingUpdateResult) =>
		sessionTimingUpdateWithStartAtStep(args.sessionStartAt, calendarUpdate)
	);
}

function validateAndSyncSessionTimingStep(args: SessionTimingSyncArgs, sessionStartAt: number) {
	return validateSessionTimingEdit({
		bypassAvailabilitySettings: args.bypassAvailabilitySettings,
		calendar: args.client.calendar,
		calendarIds: args.client.calendarIds,
		existing: {
			date: args.session.date,
			duration: args.session.duration,
			googleCalendarId: args.session.googleCalendarId,
			googleEventId: args.session.googleEventId,
			time: args.session.time
		},
		next: { date: args.date, duration: args.duration, time: args.time },
		settings: args.settings,
		timeZone: args.client.timeZone
	}).andThen(() => syncSessionTimingAfterValidationStep({ ...args, sessionStartAt }));
}

export function updateSessionTimingWithGoogleCalendar(
	args: SessionTimingSyncArgs
): ResultAsync<
	SessionCalendarTimingUpdateResult & { sessionStartAt: number },
	AdminSessionUpdateError | SessionCalendarTimingUpdateError
> {
	return getSessionStartAt(args.date, args.time, args.client.timeZone).asyncAndThen(
		(sessionStartAt: number) => validateAndSyncSessionTimingStep(args, sessionStartAt)
	);
}

export type { SessionCalendarTimingUpdateResult };
