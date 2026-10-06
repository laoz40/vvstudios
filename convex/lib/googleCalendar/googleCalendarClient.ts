"use node";

import { google } from "googleapis";

import { env } from "#convex/env";
import { getGoogleOAuthClient } from "#convex/lib/googleCalendar/googleAuth";
import {
	calendarErrorSchema,
	mapCalendarErrorCode,
	type CalendarFallbackCode
} from "#convex/lib/googleCalendar/googleCalendarErrors";
import { tryPromise } from "#convex/lib/result";

function parseGoogleCalendarAvailabilityIds(calendarId: string) {
	return (env.GOOGLE_CALENDAR_AVAILABILITY_IDS ?? calendarId)
		.split(",")
		.map((id) => id.trim())
		.filter(Boolean);
}

export function loadGoogleCalendarClient<T extends CalendarFallbackCode>(fallbackReason: T) {
	return tryPromise({
		try: () => Promise.resolve().then(() => getGoogleCalendarClient()),
		catch: (error) => {
			const parsedError = calendarErrorSchema.safeParse(error);

			return {
				reason: parsedError.success
					? mapCalendarErrorCode(parsedError.data, fallbackReason)
					: fallbackReason
			};
		}
	});
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
