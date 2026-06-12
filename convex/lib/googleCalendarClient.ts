"use node";

import { google } from "googleapis";

import { env } from "../env";

function parseGoogleCalendarAvailabilityIds(calendarId: string) {
	return (env.GOOGLE_CALENDAR_AVAILABILITY_IDS ?? calendarId)
		.split(",")
		.map((id) => id.trim())
		.filter(Boolean);
}

export function getGoogleCalendarClient() {
	const calendarId = env.GOOGLE_CALENDAR_ID;
	const oauth2Client = new google.auth.OAuth2({
		clientId: env.GOOGLE_CLIENT_ID,
		clientSecret: env.GOOGLE_CLIENT_SECRET
	});

	oauth2Client.setCredentials({ refresh_token: env.GOOGLE_REFRESH_TOKEN });

	return {
		calendarId,
		calendarIds: parseGoogleCalendarAvailabilityIds(calendarId),
		timeZone: env.GOOGLE_CALENDAR_TIMEZONE,
		calendar: google.calendar({ version: "v3", auth: oauth2Client })
	};
}
