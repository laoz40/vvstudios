import type { calendar_v3 } from "googleapis/build/src/apis/calendar/v3";
import { ResultAsync } from "neverthrow";
import type { Doc } from "#convex/_generated/dataModel";
import {
	updateSessionCalendarEventTiming,
	type SessionCalendarEventDetails,
	type SessionCalendarTimingUpdateResult
} from "#convex/lib/sessions/sessionCalendarEvents";
import type { SessionAvailabilitySettings } from "#convex/lib/sessions/sessionCalendarTime";
import {
	getSessionStartAt,
	validateSessionTimingEdit,
	type AdminSessionUpdateError
} from "#convex/lib/sessions/sessionAdminEdit";

type GoogleCalendarLike = Pick<calendar_v3.Calendar, "events">;

export interface AdminSessionGoogleCalendarClient {
	calendar: GoogleCalendarLike;
	calendarId: string;
	calendarIds: string[];
	timeZone: string;
}

export function updateSessionTimingWithGoogleCalendar({
	bypassAvailabilitySettings = false,
	session,
	client,
	date,
	details,
	duration,
	createMissingEvent = false,
	settings,
	time
}: {
	bypassAvailabilitySettings?: boolean;
	session: Doc<"bookings">;
	client: AdminSessionGoogleCalendarClient;
	date: string;
	details: SessionCalendarEventDetails;
	duration: string;
	createMissingEvent?: boolean;
	settings: SessionAvailabilitySettings;
	time: string;
}): ResultAsync<
	SessionCalendarTimingUpdateResult & { sessionStartAt: number },
	AdminSessionUpdateError
> {
	return getSessionStartAt(date, time, client.timeZone).asyncAndThen((sessionStartAt) =>
		validateSessionTimingEdit({
			bypassAvailabilitySettings,
			calendar: client.calendar,
			calendarIds: client.calendarIds,
			existing: {
				date: session.date,
				duration: session.duration,
				googleCalendarId: session.googleCalendarId,
				googleEventId: session.googleEventId,
				time: session.time
			},
			next: { date, duration, time },
			settings,
			timeZone: client.timeZone
		})
			.andThen(() =>
				updateSessionCalendarEventTiming({
					session,
					client,
					date,
					details,
					createMissingEvent,
					time
				})
			)
			.map((calendarUpdate) => ({ ...calendarUpdate, sessionStartAt }))
	);
}
