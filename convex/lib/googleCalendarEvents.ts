import type { Doc } from "../_generated/dataModel";
import type { calendar_v3 } from "googleapis/build/src/apis/calendar/v3";
import { BOOKING_INVOICE_BUSINESS } from "../../src/sites/studio/features/booking-invoice/lib/constants";
import {
	buildEventWindow,
	formatCalendarEventDate,
	formatCalendarEventTime
} from "./bookingCalendarTime";
import { isGoogleCalendarEventNotFoundError } from "./googleCalendarErrors";

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
}: BuildBookingCalendarEventPayloadArgs): calendar_v3.Schema$Event {
	const { startDateTime, endDateTime } = buildEventWindow(date, time, details.duration, timeZone);
	const bookingDate = formatCalendarEventDate(startDateTime, timeZone);
	const bookingTime = formatCalendarEventTime(startDateTime, timeZone);
	const addonsLine = details.addons.length > 0 ? details.addons.join(", ") : "None";
	const signoffName =
		BOOKING_INVOICE_BUSINESS.ownerName.split(" ")[0] ?? BOOKING_INVOICE_BUSINESS.ownerName;

	return {
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
	};
}

export function isMatchingBookingCalendarEvent(
	event: calendar_v3.Schema$Event,
	booking: Doc<"bookings">
) {
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

export async function findBookingCalendarEventIncludingDeclined({
	booking,
	calendar,
	calendarId,
	timeZone
}: {
	booking: Doc<"bookings">;
	calendar: calendar_v3.Calendar;
	calendarId: string;
	timeZone: string;
}) {
	const { startDateTime, endDateTime } = buildEventWindow(
		booking.date,
		booking.time,
		booking.duration,
		timeZone
	);
	const events = await calendar.events.list({
		calendarId,
		singleEvents: true,
		showDeleted: false,
		showHiddenInvitations: true,
		timeMax: endDateTime,
		timeMin: startDateTime
	});

	return events.data.items?.find((event) => isMatchingBookingCalendarEvent(event, booking)) ?? null;
}

async function deleteCalendarEventIfFound(
	calendar: calendar_v3.Calendar,
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

export async function deleteBookingCalendarEventIfExists({
	booking,
	calendar,
	calendarId,
	timeZone
}: {
	booking: Doc<"bookings">;
	calendar: calendar_v3.Calendar;
	calendarId: string;
	timeZone: string;
}) {
	const savedEventId = booking.googleEventId ?? null;

	if (savedEventId) {
		const wasDeleted = await deleteCalendarEventIfFound(calendar, calendarId, savedEventId);

		if (wasDeleted) return;
	}

	// Declined Calendar invites can be hidden from direct event lookup, so search the booking window before giving up.
	const foundEvent = await findBookingCalendarEventIncludingDeclined({
		booking,
		calendar,
		calendarId,
		timeZone
	});
	const foundEventId = foundEvent?.id ?? null;

	if (!foundEventId) return;

	await deleteCalendarEventIfFound(calendar, calendarId, foundEventId);
}
