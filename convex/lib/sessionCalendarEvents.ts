import type { calendar_v3 } from "googleapis/build/src/apis/calendar/v3";
import { BOOKING_INVOICE_BUSINESS } from "../../src/sites/studio/features/booking-invoice/lib/constants";
import { err, ok, type Result } from "../../src/lib/result";

import {
	buildEventWindow,
	formatCalendarEventDate,
	formatCalendarEventTime
} from "./sessionCalendarTime";
import {
	getGoogleCalendarErrorCode,
	isGoogleCalendarEventNotFoundError
} from "./googleCalendarErrors";

export interface SessionCalendarEventDetails {
	addons: string[];
	duration: string;
	email: string;
	name: string;
	service: string;
}

export type SessionCalendarEventRecord = {
	date: string;
	duration: string;
	email: string;
	googleCalendarId?: string;
	googleEventId?: string;
	name: string;
	time: string;
};

interface BuildSessionCalendarEventPayloadArgs {
	date: string;
	details: SessionCalendarEventDetails;
	time: string;
	timeZone: string;
}

export function buildSessionCalendarEventPayload({
	date,
	details,
	time,
	timeZone
}: BuildSessionCalendarEventPayloadArgs) {
	const [windowError, eventWindow] = buildEventWindow(date, time, details.duration, timeZone);

	if (windowError !== null) {
		return err(windowError);
	}

	const { startDateTime, endDateTime } = eventWindow;
	const bookingDate = formatCalendarEventDate(startDateTime, timeZone);
	const bookingTime = formatCalendarEventTime(startDateTime, timeZone);
	const addonsLine = details.addons.length > 0 ? details.addons.join(", ") : "None";
	const signoffName =
		BOOKING_INVOICE_BUSINESS.ownerName.split(" ")[0] ?? BOOKING_INVOICE_BUSINESS.ownerName;

	const payload = {
		summary: `Studio Hire | ${details.name} | ${details.duration}`,
		description: [
			`Hello, ${details.name}!`,
			"",
			"Your studio hire session has been confirmed!",
			"",
			`Recording Space: ${details.service}`,
			`Add-ons: ${addonsLine}`,
			`Session Duration: ${details.duration}`,
			"",
			`Date: ${bookingDate}`,
			`Time: ${bookingTime}`,
			`Timezone: ${timeZone}`,
			"",
			"Thanks,",
			signoffName,
			BOOKING_INVOICE_BUSINESS.locationLabel
		].join("\n"),
		location: BOOKING_INVOICE_BUSINESS.locationAddress,
		start: { dateTime: startDateTime },
		end: { dateTime: endDateTime },
		transparency: "opaque",
		attendees: [{ email: details.email }]
	} satisfies calendar_v3.Schema$Event;

	return ok(payload);
}

export type GoogleCalendarEventClient = {
	calendar: Pick<calendar_v3.Calendar, "events">;
	calendarId: string;
	timeZone: string;
};

function isMatchingSessionCalendarEvent(
	event: calendar_v3.Schema$Event,
	session: SessionCalendarEventRecord
) {
	const attendeeMatches =
		event.attendees?.some((attendee) => attendee.email === session.email) ?? false;

	// This is used when the saved Google event id cannot be used, mainly to find
	// hidden Calendar events for invites the attendee has declined.
	// Calendar summaries are created as: "Studio Hire | {name} | {duration}".
	// Match the exact name segment so we do not delete a different event in the same time window.
	const summaryParts = event.summary?.split("|").map((part) => part.trim()) ?? [];
	const summaryName = summaryParts.length === 3 ? summaryParts[1] : null;
	const summaryMatches = summaryName === session.name;

	return attendeeMatches || summaryMatches;
}

async function findSessionCalendarEventIncludingDeclined({
	session,
	calendar,
	calendarId,
	timeZone
}: {
	session: SessionCalendarEventRecord;
	calendar: Pick<calendar_v3.Calendar, "events">;
	calendarId: string;
	timeZone: string;
}) {
	const [windowError, eventWindow] = buildEventWindow(
		session.date,
		session.time,
		session.duration,
		timeZone
	);

	if (windowError !== null) {
		return err(windowError);
	}

	const { startDateTime, endDateTime } = eventWindow;
	const events = await calendar.events.list({
		calendarId,
		singleEvents: true,
		showDeleted: false,
		showHiddenInvitations: true,
		timeMax: endDateTime,
		timeMin: startDateTime
	});

	return ok(
		events.data.items?.find((event) => isMatchingSessionCalendarEvent(event, session)) ?? null
	);
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
		if (isGoogleCalendarEventNotFoundError(error)) return false;

		throw error;
	}
}

export async function deleteSessionCalendarEvent({
	session,
	client
}: {
	session: SessionCalendarEventRecord;
	client: GoogleCalendarEventClient;
}) {
	try {
		const calendarId = session.googleCalendarId ?? client.calendarId;
		const savedEventId = session.googleEventId ?? null;

		if (savedEventId) {
			const wasDeleted = await deleteCalendarEventIfFound(
				client.calendar,
				calendarId,
				savedEventId
			);
			if (wasDeleted) {
				return ok({ calendarEventDeleted: true });
			}
		}

		// Declined Calendar invites can be hidden from direct event lookup, so search the session window before giving up.
		const [findEventError, foundEvent] = await findSessionCalendarEventIncludingDeclined({
			session,
			calendar: client.calendar,
			calendarId,
			timeZone: client.timeZone
		});

		if (findEventError !== null) {
			return err({ reason: "GOOGLE_CALENDAR_DELETE_FAILED" });
		}

		const foundEventId = foundEvent?.id ?? null;

		if (!foundEventId) {
			return ok({ calendarEventDeleted: false });
		}

		const wasFoundEventDeleted = await deleteCalendarEventIfFound(
			client.calendar,
			calendarId,
			foundEventId
		);

		return ok({ calendarEventDeleted: wasFoundEventDeleted });
	} catch (error) {
		if (isGoogleCalendarEventNotFoundError(error)) {
			return ok({ calendarEventDeleted: false });
		}

		return err({ reason: getGoogleCalendarErrorCode(error, "GOOGLE_CALENDAR_DELETE_FAILED") });
	}
}

export type SessionCalendarTimingUpdateError = {
	reason:
		| "GOOGLE_CALENDAR_AUTH_FAILED"
		| "GOOGLE_CALENDAR_CREATE_FAILED"
		| "GOOGLE_CALENDAR_RATE_LIMITED"
		| "GOOGLE_CALENDAR_UPDATE_FAILED";
};

export type SessionCalendarTimingUpdateResult = {
	googleCalendarId?: string;
	googleEventId?: string;
	outcome?: "replacementCreated";
};

export async function updateSessionCalendarEventTiming({
	session,
	client,
	date,
	details,
	time,
	createMissingEvent = false
}: {
	session: SessionCalendarEventRecord;
	client: GoogleCalendarEventClient;
	date: string;
	details: SessionCalendarEventDetails;
	time: string;
	createMissingEvent?: boolean;
}): Promise<Result<SessionCalendarTimingUpdateResult, SessionCalendarTimingUpdateError>> {
	// Some reschedulable failed bookings never created a Google event in the original flow.
	// When requested, create that missing event before saving the new session time.
	if (!session.googleEventId || !session.googleCalendarId) {
		if (createMissingEvent) {
			return createSessionCalendarEvent({ client, date, details, time });
		}

		return ok({});
	}

	const googleCalendarId = session.googleCalendarId;
	const googleEventId = session.googleEventId;

	try {
		const existingGoogleEvent = await client.calendar.events.get({
			calendarId: googleCalendarId,
			eventId: googleEventId
		});

		if (existingGoogleEvent.data.status === "cancelled") {
			return createSessionCalendarEvent({ client, date, details, time });
		}

		const [payloadError, requestBody] = buildSessionCalendarEventPayload({
			date,
			details,
			time,
			timeZone: client.timeZone
		});
		if (payloadError !== null) {
			return err({ reason: "GOOGLE_CALENDAR_UPDATE_FAILED" });
		}

		await client.calendar.events.patch({
			calendarId: googleCalendarId,
			eventId: googleEventId,
			sendUpdates: "all",
			requestBody
		});
	} catch (error) {
		if (isGoogleCalendarEventNotFoundError(error)) {
			return createSessionCalendarEvent({ client, date, details, time });
		}

		return err({ reason: getGoogleCalendarErrorCode(error, "GOOGLE_CALENDAR_UPDATE_FAILED") });
	}

	return ok({});
}

export async function createSessionCalendarEvent({
	client,
	date,
	details,
	time
}: {
	client: GoogleCalendarEventClient;
	date: string;
	details: SessionCalendarEventDetails;
	time: string;
}) {
	try {
		const [payloadError, requestBody] = buildSessionCalendarEventPayload({
			date,
			details,
			time,
			timeZone: client.timeZone
		});
		if (payloadError !== null) {
			return err({ reason: "GOOGLE_CALENDAR_CREATE_FAILED" });
		}

		const replacementEvent = await client.calendar.events.insert({
			calendarId: client.calendarId,
			sendUpdates: "all",
			requestBody
		});

		return ok({
			googleCalendarId: client.calendarId,
			googleEventId: replacementEvent.data.id ?? undefined,
			outcome: "replacementCreated" as const
		});
	} catch (error) {
		return err({ reason: getGoogleCalendarErrorCode(error, "GOOGLE_CALENDAR_CREATE_FAILED") });
	}
}
