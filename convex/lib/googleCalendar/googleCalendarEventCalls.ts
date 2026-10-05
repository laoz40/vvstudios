import type { calendar_v3 } from "googleapis/build/src/apis/calendar/v3";
import type { Id } from "#convex/_generated/dataModel";
import {
	calendarErrorSchema,
	calendarResultAsync,
	isCalendarEventNotFound,
	mapCalendarErrorCode
} from "#convex/lib/googleCalendar/googleCalendarErrors";
import { tryPromise } from "#convex/lib/result";

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
			console.error("Orphaned session Calendar event cleanup failed", {
				bookingId,
				googleEventId,
				error
			});

			const parsedError = calendarErrorSchema.safeParse(error);

			return {
				reason: parsedError.success
					? mapCalendarErrorCode(parsedError.data, "GOOGLE_CALENDAR_DELETE_FAILED")
					: "GOOGLE_CALENDAR_DELETE_FAILED"
			};
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

			return {
				reason: parsedError.success
					? mapCalendarErrorCode(parsedError.data, "GOOGLE_CALENDAR_DELETE_FAILED")
					: ("GOOGLE_CALENDAR_DELETE_FAILED" as const)
			};
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
	return calendarResultAsync(
		calendar.events.list({
			calendarId,
			singleEvents: true,
			showDeleted: false,
			showHiddenInvitations: true,
			timeMax,
			timeMin
		}),
		"GOOGLE_CALENDAR_DELETE_FAILED"
	).map((response) => response.data.items ?? []);
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

			return {
				reason: parsedError.success
					? mapCalendarErrorCode(parsedError.data, fallbackReason)
					: fallbackReason
			};
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

			return {
				reason: parsedError.success
					? mapCalendarErrorCode(parsedError.data, "GOOGLE_CALENDAR_UPDATE_FAILED")
					: "GOOGLE_CALENDAR_UPDATE_FAILED"
			};
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
	return calendarResultAsync(
		calendar.events.insert({ calendarId, sendUpdates: "all", requestBody }),
		"GOOGLE_CALENDAR_CREATE_FAILED"
	);
}
