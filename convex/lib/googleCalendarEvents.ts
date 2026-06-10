import type { Doc } from "../_generated/dataModel";
import type { calendar_v3 } from "googleapis/build/src/apis/calendar/v3";
import { BOOKING_INVOICE_BUSINESS } from "../../src/sites/studio/features/booking-invoice/lib/constants";
import {
	buildEventWindow,
	formatCalendarEventDate,
	formatCalendarEventTime,
} from "./bookingCalendarTime";

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
	timeZone,
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
			BOOKING_INVOICE_BUSINESS.locationLabel,
		].join("\n"),
		location: BOOKING_INVOICE_BUSINESS.locationAddress,
		start: {
			dateTime: startDateTime,
		},
		end: {
			dateTime: endDateTime,
		},
		transparency: "opaque",
		attendees: [{ email: details.email }],
	};
}

export function isMatchingBookingCalendarEvent(
	event: calendar_v3.Schema$Event,
	booking: Doc<"bookings">,
) {
	const attendeeMatches =
		event.attendees?.some((attendee) => attendee.email === booking.email) ?? false;
	const summaryMatches = event.summary?.includes(booking.name) ?? false;

	return attendeeMatches || summaryMatches;
}

export async function findBookingCalendarEventIncludingDeclined({
	booking,
	calendar,
	calendarId,
	timeZone,
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
		timeZone,
	);
	const events = await calendar.events.list({
		calendarId,
		singleEvents: true,
		showDeleted: false,
		showHiddenInvitations: true,
		timeMax: endDateTime,
		timeMin: startDateTime,
	});

	return events.data.items?.find((event) => isMatchingBookingCalendarEvent(event, booking)) ?? null;
}
