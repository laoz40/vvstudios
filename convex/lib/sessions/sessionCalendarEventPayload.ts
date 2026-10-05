import type { calendar_v3 } from "googleapis/build/src/apis/calendar/v3";
import { BOOKING_INVOICE_BUSINESS } from "#studio/features/booking-invoice/lib/constants";
import type { BookingAddonQuantitiesArgs } from "#convex/lib/booking/bookingAddonQuantities";
import {
	pickBookingAddonQuantities,
	type BookingAddon
} from "#studio/features/booking-form/lib/booking-form-model";
import { formatEditingAddonList } from "#studio/features/booking-form/lib/editing-addon-quantities";
import type { Result } from "neverthrow";

import {
	buildEventWindow,
	formatCalendarEventDate,
	formatCalendarEventTime
} from "#convex/lib/sessions/sessionCalendarTime";

export type SessionCalendarEventDetails = {
	addons: BookingAddon[];
	duration: string;
	email: string;
	name: string;
	service: string;
} & BookingAddonQuantitiesArgs;

export type SessionCalendarEventRecord = {
	date: string;
	duration: string;
	email: string;
	googleCalendarId?: string;
	googleEventId?: string;
	name: string;
	time: string;
};

export type GoogleCalendarEventClient = {
	calendar: Pick<calendar_v3.Calendar, "events">;
	calendarId: string;
	timeZone: string;
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
}: BuildSessionCalendarEventPayloadArgs): Result<calendar_v3.Schema$Event, { reason: string }> {
	return buildEventWindow(date, time, details.duration, timeZone).map(
		({ startDateTime, endDateTime }) => {
			const bookingDate = formatCalendarEventDate(startDateTime, timeZone);
			const bookingTime = formatCalendarEventTime(startDateTime, timeZone);

			const addonsLine =
				details.addons.length > 0
					? formatEditingAddonList(details.addons, pickBookingAddonQuantities(details))
					: "None";

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

			return payload;
		}
	);
}

export function matchingSessionCalendarEventStep(
	session: SessionCalendarEventRecord,
	events: calendar_v3.Schema$Event[]
) {
	return events.find((event) => isMatchingSessionCalendarEvent(event, session)) ?? null;
}

export function isMatchingSessionCalendarEvent(
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
