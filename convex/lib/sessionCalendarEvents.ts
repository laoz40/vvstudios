import type { calendar_v3 } from "googleapis/build/src/apis/calendar/v3";
import { BOOKING_INVOICE_BUSINESS } from "#studio/features/booking-invoice/lib/constants";
import {
	err as neverthrowErr,
	ok as neverthrowOk,
	type Result as NeverthrowResult
} from "neverthrow";
import { err, ok, type Result } from "#/lib/result";

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
	return buildSessionCalendarEventPayloadResult({ date, details, time, timeZone }).match(
		(value) => ok(value),
		(error) => err(error)
	);
}

export function buildSessionCalendarEventPayloadResult({
	date,
	details,
	time,
	timeZone
}: BuildSessionCalendarEventPayloadArgs) {
	const [windowError, eventWindow] = buildEventWindow(date, time, details.duration, timeZone);

	if (windowError !== null) {
		return neverthrowErr(windowError);
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

	return neverthrowOk(payload);
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

async function findSessionCalendarEventIncludingDeclinedResult({
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
		return neverthrowErr(windowError);
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

	return neverthrowOk(
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
	return await deleteSessionCalendarEventResult({ session, client }).then((result) =>
		result.match(
			(value) => ok(value),
			(error) => err(error)
		)
	);
}

export async function deleteSessionCalendarEventResult({
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
				return neverthrowOk({ calendarEventDeleted: true });
			}
		}

		// Declined Calendar invites can be hidden from direct event lookup, so search the session window before giving up.
		const foundEventResult = await findSessionCalendarEventIncludingDeclinedResult({
			session,
			calendar: client.calendar,
			calendarId,
			timeZone: client.timeZone
		});

		if (foundEventResult.isErr()) {
			return neverthrowErr({ reason: "GOOGLE_CALENDAR_DELETE_FAILED" as const });
		}

		const foundEventId = foundEventResult.value?.id ?? null;

		if (!foundEventId) {
			return neverthrowOk({ calendarEventDeleted: false });
		}

		const wasFoundEventDeleted = await deleteCalendarEventIfFound(
			client.calendar,
			calendarId,
			foundEventId
		);

		return neverthrowOk({ calendarEventDeleted: wasFoundEventDeleted });
	} catch (error) {
		if (isGoogleCalendarEventNotFoundError(error)) {
			return neverthrowOk({ calendarEventDeleted: false });
		}

		return neverthrowErr({
			reason: getGoogleCalendarErrorCode(error, "GOOGLE_CALENDAR_DELETE_FAILED")
		});
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
	return await updateSessionCalendarEventTimingResult({
		session,
		client,
		date,
		details,
		time,
		createMissingEvent
	}).then((result) =>
		result.match(
			(value) => ok(value),
			(error) => err(error)
		)
	);
}

export async function updateSessionCalendarEventTimingResult({
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
}): Promise<NeverthrowResult<SessionCalendarTimingUpdateResult, SessionCalendarTimingUpdateError>> {
	// Some reschedulable failed bookings never created a Google event in the original flow.
	// When requested, create that missing event before saving the new session time.
	if (!session.googleEventId || !session.googleCalendarId) {
		if (createMissingEvent) {
			return createSessionCalendarEventResult({ client, date, details, time });
		}

		return neverthrowOk({});
	}

	const googleCalendarId = session.googleCalendarId;
	const googleEventId = session.googleEventId;

	try {
		const existingGoogleEvent = await client.calendar.events.get({
			calendarId: googleCalendarId,
			eventId: googleEventId
		});

		if (existingGoogleEvent.data.status === "cancelled") {
			return createSessionCalendarEventResult({ client, date, details, time });
		}

		const payloadResult = buildSessionCalendarEventPayloadResult({
			date,
			details,
			time,
			timeZone: client.timeZone
		});
		if (payloadResult.isErr()) {
			return neverthrowErr({ reason: "GOOGLE_CALENDAR_UPDATE_FAILED" as const });
		}

		await client.calendar.events.patch({
			calendarId: googleCalendarId,
			eventId: googleEventId,
			sendUpdates: "all",
			requestBody: payloadResult.value
		});
	} catch (error) {
		if (isGoogleCalendarEventNotFoundError(error)) {
			return createSessionCalendarEventResult({ client, date, details, time });
		}

		return neverthrowErr({
			reason: getGoogleCalendarErrorCode(error, "GOOGLE_CALENDAR_UPDATE_FAILED")
		});
	}

	return neverthrowOk({});
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
	return await createSessionCalendarEventResult({ client, date, details, time }).then((result) =>
		result.match(
			(value) => ok(value),
			(error) => err(error)
		)
	);
}

export async function createSessionCalendarEventResult({
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
		const payloadResult = buildSessionCalendarEventPayloadResult({
			date,
			details,
			time,
			timeZone: client.timeZone
		});
		if (payloadResult.isErr()) {
			return neverthrowErr({ reason: "GOOGLE_CALENDAR_CREATE_FAILED" as const });
		}

		const replacementEvent = await client.calendar.events.insert({
			calendarId: client.calendarId,
			sendUpdates: "all",
			requestBody: payloadResult.value
		});

		return neverthrowOk({
			googleCalendarId: client.calendarId,
			googleEventId: replacementEvent.data.id ?? undefined,
			outcome: "replacementCreated" as const
		});
	} catch (error) {
		return neverthrowErr({
			reason: getGoogleCalendarErrorCode(error, "GOOGLE_CALENDAR_CREATE_FAILED")
		});
	}
}
