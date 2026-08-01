"use node";

import { google } from "googleapis";
import { ResultAsync } from "neverthrow";

import { env } from "#convex/env";
import {
	getGoogleCalendarErrorCode,
	type GoogleCalendarFallbackErrorCode
} from "./googleCalendarErrors";

function parseGoogleCalendarAvailabilityIds(calendarId: string) {
	return (env.GOOGLE_CALENDAR_AVAILABILITY_IDS ?? calendarId)
		.split(",")
		.map((id) => id.trim())
		.filter(Boolean);
}

export function getGoogleCalendarClientResult<T extends GoogleCalendarFallbackErrorCode>(
	fallbackReason: T
) {
	return ResultAsync.fromPromise(
		Promise.resolve().then(() => getGoogleCalendarClient()),
		(error) => ({ reason: getGoogleCalendarErrorCode(error, fallbackReason) })
	);
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
