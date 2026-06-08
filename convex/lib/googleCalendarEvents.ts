import type { calendar_v3 } from "googleapis/build/src/apis/calendar/v3";
import { BOOKING_INVOICE_BUSINESS } from "../../src/sites/studio/features/booking-invoice/lib/constants";
import {
	buildEventWindow,
	formatCalendarEventDate,
	formatCalendarEventTime,
} from "./bookingCalendarTime";

type GoogleCalendarLike = Pick<calendar_v3.Calendar, "events">;

interface BookingCalendarEventDetails {
	addons: string[];
	duration: string;
	email: string;
	name: string;
	service: string;
}

interface BuildBookingCalendarEventRequestBodyArgs extends BookingCalendarEventDetails {
	endDateTime: string;
	startDateTime: string;
	timeZone: string;
}

interface CreateBookingCalendarEventArgs {
	calendar: GoogleCalendarLike;
	calendarId: string;
	date: string;
	details: BookingCalendarEventDetails;
	time: string;
	timeZone: string;
}

function buildBookingCalendarEventRequestBody({
	name,
	duration,
	service,
	addons,
	startDateTime,
	endDateTime,
	timeZone,
	email,
}: BuildBookingCalendarEventRequestBodyArgs): calendar_v3.Schema$Event {
	const bookingDate = formatCalendarEventDate(startDateTime, timeZone);
	const bookingTime = formatCalendarEventTime(startDateTime, timeZone);
	const addonsLine = addons.length > 0 ? addons.join(", ") : "None";
	const signoffName =
		BOOKING_INVOICE_BUSINESS.ownerName.split(" ")[0] ?? BOOKING_INVOICE_BUSINESS.ownerName;

	return {
		summary: `Studio Hire | ${name} | ${duration}`,
		description: [
			`Hello, ${name}!`,
			"",
			"Your studio hire booking has been confirmed!",
			"",
			`Recording Space: ${service}`,
			`Add-ons: ${addonsLine}`,
			`Session Duration: ${duration}`,
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
		attendees: [{ email }],
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
	const { startDateTime, endDateTime } = buildEventWindow(date, time, details.duration, timeZone);

	const event = await calendar.events.insert({
		calendarId,
		sendUpdates: "all",
		requestBody: buildBookingCalendarEventRequestBody({
			addons: details.addons,
			name: details.name,
			duration: details.duration,
			email: details.email,
			service: details.service,
			startDateTime,
			endDateTime,
			timeZone,
		}),
	});

	return {
		googleEventId: event.data.id ?? undefined,
	};
}
