"use node";

import { google } from "googleapis";

import { env } from "#convex/env";
import { getGoogleOAuthClient } from "#convex/lib/googleAuth";
import { calendarResultAsync, type CalendarFallbackCode } from "#convex/lib/googleCalendarErrors";

function parseGoogleCalendarAvailabilityIds(calendarId: string) {
	return (env.GOOGLE_CALENDAR_AVAILABILITY_IDS ?? calendarId)
		.split(",")
		.map((id) => id.trim())
		.filter(Boolean);
}

export function loadGoogleCalendarClient<T extends CalendarFallbackCode>(fallbackReason: T) {
	return calendarResultAsync(
		Promise.resolve().then(() => getGoogleCalendarClient()),
		fallbackReason
	);
}

export function getGoogleCalendarClient() {
	const calendarId = env.GOOGLE_CALENDAR_ID;
	const oauth2Client = getGoogleOAuthClient();

	return {
		calendarId,
		calendarIds: parseGoogleCalendarAvailabilityIds(calendarId),
		timeZone: env.GOOGLE_CALENDAR_TIMEZONE,
		calendar: google.calendar({ version: "v3", auth: oauth2Client })
	};
}
