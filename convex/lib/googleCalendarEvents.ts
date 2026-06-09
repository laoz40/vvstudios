import type { calendar_v3 } from "googleapis/build/src/apis/calendar/v3";
import { BOOKING_INVOICE_BUSINESS } from "../../src/sites/studio/features/booking-invoice/lib/constants";
import {
	buildEventWindow,
	formatCalendarEventDate,
	formatCalendarEventTime,
} from "./bookingCalendarTime";

type GoogleCalendarLike = Pick<calendar_v3.Calendar, "events">;

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

interface MutateBookingCalendarEventArgs extends BuildBookingCalendarEventPayloadArgs {
	calendar: GoogleCalendarLike;
	calendarId: string;
}

type CreateBookingCalendarEventArgs = MutateBookingCalendarEventArgs;

interface PatchBookingCalendarEventArgs extends MutateBookingCalendarEventArgs {
	eventId: string;
}

interface GetBookingCalendarEventArgs {
	calendar: GoogleCalendarLike;
	calendarId: string;
	eventId: string;
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

export async function createBookingCalendarEvent({
	calendar,
	calendarId,
	date,
	details,
	time,
	timeZone,
}: CreateBookingCalendarEventArgs) {
	const event = await calendar.events.insert({
		calendarId,
		sendUpdates: "all",
		requestBody: buildBookingCalendarEventPayload({
			date,
			details,
			time,
			timeZone,
		}),
	});

	return {
		googleEventId: event.data.id ?? undefined,
	};
}

export async function getBookingCalendarEvent({
	calendar,
	calendarId,
	eventId,
}: GetBookingCalendarEventArgs) {
	const event = await calendar.events.get({
		calendarId,
		eventId,
	});

	return event.data;
}

export async function patchBookingCalendarEvent({
	calendar,
	calendarId,
	date,
	details,
	eventId,
	time,
	timeZone,
}: PatchBookingCalendarEventArgs) {
	await calendar.events.patch({
		calendarId,
		eventId,
		sendUpdates: "all",
		requestBody: buildBookingCalendarEventPayload({
			date,
			details,
			time,
			timeZone,
		}),
	});
}
