import type { calendar_v3 } from "googleapis/build/src/apis/calendar/v3";
import { BOOKING_INVOICE_BUSINESS } from "../../src/sites/studio/features/booking-invoice/lib/constants";
import { err, ok, type Result } from "../../src/lib/result";
import type { Doc } from "../_generated/dataModel";
import {
	buildEventWindow,
	formatCalendarEventDate,
	formatCalendarEventTime
} from "./bookingCalendarTime";
import {
	getGoogleCalendarErrorCode,
	isGoogleCalendarEventNotFoundError
} from "./googleCalendarErrors";

export interface BookingCalendarEventDetails {
	addons: string[];
	duration: string;
	email: string;
	name: string;
	service: string;
}

interface BuildBookingCalendarEventPayloadArgs {
	date: string;
	details: BookingCalendarEventDetails;
	time: string;
	timeZone: string;
}

export function buildBookingCalendarEventPayload({
	date,
	details,
	time,
	timeZone
}: BuildBookingCalendarEventPayloadArgs) {
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

	return ok({
		summary: `Studio Hire | ${details.name} | ${details.duration}`,
		description: [
			`Hello, ${details.name}!`,
			"",
			"Your studio hire booking has been confirmed!",
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
	} satisfies calendar_v3.Schema$Event);
}

export type GoogleCalendarEventClient = {
	calendar: Pick<calendar_v3.Calendar, "events">;
	calendarId: string;
	timeZone: string;
};

function isMatchingBookingCalendarEvent(event: calendar_v3.Schema$Event, booking: Doc<"bookings">) {
	const attendeeMatches =
		event.attendees?.some((attendee) => attendee.email === booking.email) ?? false;

	// This is used when the saved Google event id cannot be used, mainly to find
	// hidden Calendar events for invites the attendee has declined.
	// Calendar summaries are created as: "Studio Hire | {name} | {duration}".
	// Match the exact name segment so we do not delete a different event in the same time window.
	const summaryParts = event.summary?.split("|").map((part) => part.trim()) ?? [];
	const summaryName = summaryParts.length === 3 ? summaryParts[1] : null;
	const summaryMatches = summaryName === booking.name;

	return attendeeMatches || summaryMatches;
}

async function findBookingCalendarEventIncludingDeclined({
	booking,
	calendar,
	calendarId,
	timeZone
}: {
	booking: Doc<"bookings">;
	calendar: Pick<calendar_v3.Calendar, "events">;
	calendarId: string;
	timeZone: string;
}) {
	const [windowError, eventWindow] = buildEventWindow(
		booking.date,
		booking.time,
		booking.duration,
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
		events.data.items?.find((event) => isMatchingBookingCalendarEvent(event, booking)) ?? null
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

export async function deleteBookingCalendarEvent({
	booking,
	client
}: {
	booking: Doc<"bookings">;
	client: GoogleCalendarEventClient;
}) {
	try {
		const calendarId = booking.googleCalendarId ?? client.calendarId;
		const savedEventId = booking.googleEventId ?? null;

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

		// Declined Calendar invites can be hidden from direct event lookup, so search the booking window before giving up.
		const [findEventError, foundEvent] = await findBookingCalendarEventIncludingDeclined({
			booking,
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

export type BookingCalendarTimingUpdateError = {
	reason:
		| "GOOGLE_CALENDAR_AUTH_FAILED"
		| "GOOGLE_CALENDAR_CREATE_FAILED"
		| "GOOGLE_CALENDAR_RATE_LIMITED"
		| "GOOGLE_CALENDAR_UPDATE_FAILED";
};

export type BookingCalendarTimingUpdateResult = {
	googleCalendarId?: string;
	googleEventId?: string;
	outcome?: "replacementCreated";
};

export async function updateBookingCalendarEventTiming({
	booking,
	client,
	date,
	details,
	time
}: {
	booking: Doc<"bookings">;
	client: GoogleCalendarEventClient;
	date: string;
	details: BookingCalendarEventDetails;
	time: string;
}): Promise<Result<BookingCalendarTimingUpdateResult, BookingCalendarTimingUpdateError>> {
	// Confirmed bookings without a Google event link are left unchanged for now.
	if (!booking.googleEventId || !booking.googleCalendarId) {
		return ok({});
	}

	const googleCalendarId = booking.googleCalendarId;
	const googleEventId = booking.googleEventId;

	try {
		const existingGoogleEvent = await client.calendar.events.get({
			calendarId: googleCalendarId,
			eventId: googleEventId
		});

		if (existingGoogleEvent.data.status === "cancelled") {
			return createReplacementBookingCalendarEvent({ client, date, details, time });
		}

		const [payloadError, requestBody] = buildBookingCalendarEventPayload({
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
			return createReplacementBookingCalendarEvent({ client, date, details, time });
		}

		return err({ reason: getGoogleCalendarErrorCode(error, "GOOGLE_CALENDAR_UPDATE_FAILED") });
	}

	return ok({});
}

async function createReplacementBookingCalendarEvent({
	client,
	date,
	details,
	time
}: {
	client: GoogleCalendarEventClient;
	date: string;
	details: BookingCalendarEventDetails;
	time: string;
}) {
	try {
		const [payloadError, requestBody] = buildBookingCalendarEventPayload({
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
