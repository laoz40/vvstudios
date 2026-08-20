"use node";

import { google } from "googleapis";
import { ResultAsync } from "neverthrow";

import { env } from "#convex/env";
import { getGoogleOAuthClient } from "#convex/lib/googleAuth";
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

export function loadGoogleCalendarClient<T extends GoogleCalendarFallbackErrorCode>(
	fallbackReason: T
) {
	return ResultAsync.fromPromise(
		Promise.resolve().then(() => getGoogleCalendarClient()),
		(error) => ({ reason: getGoogleCalendarErrorCode(error, fallbackReason) })
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
