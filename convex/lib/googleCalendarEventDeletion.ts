"use node";

import { ConvexError } from "convex/values";
import type { calendar_v3 } from "googleapis/build/src/apis/calendar/v3";
import { err, ok } from "../../src/lib/result";
import type { Doc } from "../_generated/dataModel";
import { buildEventWindow } from "./bookingCalendarTime";
import { getGoogleCalendarClient } from "./googleCalendarClient";
import { isGoogleCalendarEventNotFoundError } from "./googleCalendarErrors";

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

export async function deleteBookingCalendarEvent({ booking }: { booking: Doc<"bookings"> }) {
	try {
		const client = getGoogleCalendarClient();
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
		const foundEvent = await findBookingCalendarEventIncludingDeclined({
			booking,
			calendar: client.calendar,
			calendarId,
			timeZone: client.timeZone
		});
		const foundEventId = foundEvent?.id ?? null;

		if (foundEventId) {
			await deleteCalendarEventIfFound(client.calendar, calendarId, foundEventId);
		}

		return ok({ calendarEventDeleted: true });
	} catch (error) {
		if (error instanceof ConvexError) {
			const code = (error.data as { code?: string }).code;

			switch (code) {
				case "GOOGLE_CALENDAR_AUTH_FAILED":
					return err({ reason: "GOOGLE_CALENDAR_AUTH_FAILED" });

				case "GOOGLE_CALENDAR_DELETE_FAILED":
					return err({ reason: "GOOGLE_CALENDAR_DELETE_FAILED" });

				case "GOOGLE_CALENDAR_EVENT_NOT_FOUND":
					return err({ reason: "GOOGLE_CALENDAR_EVENT_NOT_FOUND" });

				case "GOOGLE_CALENDAR_RATE_LIMITED":
					return err({ reason: "GOOGLE_CALENDAR_RATE_LIMITED" });

				default:
					return err({ reason: "GOOGLE_CALENDAR_DELETE_FAILED" });
			}
		}

		return err({ reason: "GOOGLE_CALENDAR_DELETE_FAILED" });
	}
}
