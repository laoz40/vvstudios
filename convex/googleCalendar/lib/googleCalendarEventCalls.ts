import type { calendar_v3 } from "googleapis/build/src/apis/calendar/v3";
import type { Id } from "#convex/_generated/dataModel";
import {
	calendarErrorSchema,
	isCalendarEventNotFound,
	mapCalendarErrorCode
} from "#convex/googleCalendar/lib/googleCalendarErrors";
import { logError } from "#convex/shared/lib/logger";
import { tryPromise } from "#convex/shared/lib/result";

export type GoogleCalendarDeleteError = {
	reason:
		| "GOOGLE_CALENDAR_DELETE_FAILED"
		| "GOOGLE_CALENDAR_AUTH_FAILED"
		| "GOOGLE_CALENDAR_RATE_LIMITED";
};

export type GoogleCalendarTimingMutationError = {
	reason:
		| "GOOGLE_CALENDAR_AUTH_FAILED"
		| "GOOGLE_CALENDAR_CREATE_FAILED"
		| "GOOGLE_CALENDAR_RATE_LIMITED"
		| "GOOGLE_CALENDAR_UPDATE_FAILED";
};

export type OrphanedSessionCalendarEventCleanupError = GoogleCalendarDeleteError;

export function removeOrphanedSessionCalendarEvent({
	bookingId,
	calendar,
	calendarId,
	googleEventId
}: {
	bookingId: Id<"bookings">;
	calendar: Pick<calendar_v3.Calendar, "events">;
	calendarId: string;
	googleEventId: string;
}) {
	return tryPromise({
		try: () => calendar.events.delete({ calendarId, eventId: googleEventId, sendUpdates: "all" }),
		catch: (error) => {
			const parsedError = calendarErrorSchema.safeParse(error);

			const failure = {
				reason: parsedError.success
					? mapCalendarErrorCode(parsedError.data, "GOOGLE_CALENDAR_DELETE_FAILED")
					: "GOOGLE_CALENDAR_DELETE_FAILED"
			};

			if (!parsedError.success || !isCalendarEventNotFound(parsedError.data)) {
				logError(
					{
						operation: "googleCalendar.event.removeOrphaned",
						...failure,
						bookingId,
						googleEventId
					},
					error
				);
			}

			return failure;
		}
	}).map(() => undefined);
}

async function deleteCalendarEventIfFound(
	calendar: Pick<calendar_v3.Calendar, "events">,
	calendarId: string,
	eventId: string
) {
	try {
		await calendar.events.delete({ calendarId, eventId, sendUpdates: "all" });

		return true;
	} catch (error) {
		const parsedError = calendarErrorSchema.safeParse(error);

		if (parsedError.success && isCalendarEventNotFound(parsedError.data)) {
			return false;
		}

		throw error;
	}
}

export function deleteGoogleCalendarEventIfFound(
	calendar: Pick<calendar_v3.Calendar, "events">,
	calendarId: string,
	eventId: string
) {
	return tryPromise({
		try: () => deleteCalendarEventIfFound(calendar, calendarId, eventId),
		catch: (cause) => {
			const parsedError = calendarErrorSchema.safeParse(cause);

			if (parsedError.success && isCalendarEventNotFound(parsedError.data)) {
				return { reason: "GOOGLE_CALENDAR_DELETE_FAILED" as const };
			}

			const failure = {
				reason: parsedError.success
					? mapCalendarErrorCode(parsedError.data, "GOOGLE_CALENDAR_DELETE_FAILED")
					: "GOOGLE_CALENDAR_DELETE_FAILED"
			};

			logError(
				{ operation: "googleCalendar.event.deleteIfFound", ...failure, calendarId, eventId },
				cause
			);

			return failure;
		}
	});
}

export function listGoogleCalendarEventsInWindow({
	calendar,
	calendarId,
	timeMax,
	timeMin
}: {
	calendar: Pick<calendar_v3.Calendar, "events">;
	calendarId: string;
	timeMax: string;
	timeMin: string;
}) {
	return tryPromise({
		try: () =>
			calendar.events.list({
				calendarId,
				singleEvents: true,
				showDeleted: false,
				showHiddenInvitations: true,
				timeMax,
				timeMin
			}),
		catch: (error) => {
			const parsedError = calendarErrorSchema.safeParse(error);

			const failure = {
				reason: parsedError.success
					? mapCalendarErrorCode(parsedError.data, "GOOGLE_CALENDAR_DELETE_FAILED")
					: "GOOGLE_CALENDAR_DELETE_FAILED"
			};

			logError({ operation: "googleCalendar.events.list", ...failure, calendarId }, error);

			return failure;
		}
	}).map((response) => response.data.items ?? []);
}

export type GoogleCalendarEventMissing = { kind: "missing" };

export function getGoogleCalendarEvent({
	calendar,
	calendarId,
	eventId
}: {
	calendar: Pick<calendar_v3.Calendar, "events">;
	calendarId: string;
	eventId: string;
}) {
	const fallbackReason = "GOOGLE_CALENDAR_UPDATE_FAILED" as const;

	return tryPromise({
		try: () => calendar.events.get({ calendarId, eventId }),
		catch: (cause): GoogleCalendarEventMissing | GoogleCalendarTimingMutationError => {
			const parsedError = calendarErrorSchema.safeParse(cause);

			if (parsedError.success && isCalendarEventNotFound(parsedError.data)) {
				return { kind: "missing" };
			}

			const failure = {
				reason: parsedError.success
					? mapCalendarErrorCode(parsedError.data, fallbackReason)
					: fallbackReason
			};

			logError({ operation: "googleCalendar.event.get", ...failure, calendarId, eventId }, cause);

			return failure;
		}
	});
}

export function patchGoogleCalendarEvent({
	calendar,
	calendarId,
	eventId,
	requestBody
}: {
	calendar: Pick<calendar_v3.Calendar, "events">;
	calendarId: string;
	eventId: string;
	requestBody: calendar_v3.Schema$Event;
}) {
	return tryPromise({
		try: () => calendar.events.patch({ calendarId, eventId, sendUpdates: "all", requestBody }),
		catch: (cause): GoogleCalendarEventMissing | GoogleCalendarTimingMutationError => {
			const parsedError = calendarErrorSchema.safeParse(cause);

			if (parsedError.success && isCalendarEventNotFound(parsedError.data)) {
				return { kind: "missing" };
			}

			const failure = {
				reason: parsedError.success
					? mapCalendarErrorCode(parsedError.data, "GOOGLE_CALENDAR_UPDATE_FAILED")
					: "GOOGLE_CALENDAR_UPDATE_FAILED"
			};

			logError({ operation: "googleCalendar.event.patch", ...failure, calendarId, eventId }, cause);

			return failure;
		}
	});
}

export function insertGoogleCalendarEvent({
	calendar,
	calendarId,
	requestBody
}: {
	calendar: Pick<calendar_v3.Calendar, "events">;
	calendarId: string;
	requestBody: calendar_v3.Schema$Event;
}) {
	return tryPromise({
		try: () => calendar.events.insert({ calendarId, sendUpdates: "all", requestBody }),
		catch: (error) => {
			const parsedError = calendarErrorSchema.safeParse(error);

			const failure = {
				reason: parsedError.success
					? mapCalendarErrorCode(parsedError.data, "GOOGLE_CALENDAR_CREATE_FAILED")
					: "GOOGLE_CALENDAR_CREATE_FAILED"
			};

			logError({ operation: "googleCalendar.event.insert", ...failure, calendarId }, error);

			return failure;
		}
	});
}
