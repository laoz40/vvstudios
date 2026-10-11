import type { calendar_v3 } from "googleapis/build/src/apis/calendar/v3";
import type { Doc } from "#convex/_generated/dataModel";
import type { SessionCalendarEventDetails } from "#convex/sessions/lib/calendarEventPayload";
import type { SessionAvailabilitySettings } from "#convex/sessions/lib/calendarTime";

type GoogleCalendarLike = Pick<calendar_v3.Calendar, "events">;

export interface AdminSessionGoogleCalendarClient {
	calendar: GoogleCalendarLike;
	calendarId: string;
	calendarIds: string[];
	timeZone: string;
}

export type SessionTimingSyncArgs = {
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

export type SessionCalendarTimingUpdateResult = {
	googleCalendarId?: string;
	googleEventId?: string;
	outcome?: "replacementCreated";
};
