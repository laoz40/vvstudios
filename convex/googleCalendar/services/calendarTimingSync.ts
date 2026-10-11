"use node";

import type { ResultAsync } from "neverthrow";
import type { SessionTimingSyncArgs } from "#convex/googleCalendar/lib/calendarTimingSync";
import {
	updateSessionCalendarEventTiming,
	type SessionCalendarTimingUpdateResult,
	type SessionCalendarTimingUpdateError
} from "#convex/googleCalendar/services/calendarEvent";
import { getSessionStartAt, type AdminSessionUpdateError } from "#convex/sessions/lib/adminEdit";
import { validateSessionTimingEdit } from "#convex/sessions/services/adminEdit";

export function updateSessionTimingWithGoogleCalendar(
	args: SessionTimingSyncArgs
): ResultAsync<
	SessionCalendarTimingUpdateResult & { sessionStartAt: number },
	AdminSessionUpdateError | SessionCalendarTimingUpdateError
> {
	return getSessionStartAt(args.date, args.time, args.client.timeZone).asyncAndThen(
		(sessionStartAt: number) =>
			validateSessionTimingEdit({
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
			}).andThen(() =>
				updateSessionCalendarEventTiming({
					session: args.session,
					client: args.client,
					date: args.date,
					details: args.details,
					createMissingEvent: args.createMissingEvent,
					time: args.time
				}).map((calendarUpdate: SessionCalendarTimingUpdateResult) => ({
					...calendarUpdate,
					sessionStartAt
				}))
			)
	);
}

export type { SessionCalendarTimingUpdateResult };
