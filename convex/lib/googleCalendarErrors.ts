import { z } from "zod";

export type GoogleCalendarFallbackErrorCode =
	| "GOOGLE_CALENDAR_AVAILABILITY_FAILED"
	| "GOOGLE_CALENDAR_CREATE_FAILED"
	| "GOOGLE_CALENDAR_DELETE_FAILED"
	| "GOOGLE_CALENDAR_SYNC_FAILED"
	| "GOOGLE_CALENDAR_UPDATE_FAILED";

export type GoogleCalendarWriteError =
	| { reason: "GOOGLE_CALENDAR_AUTH_FAILED" }
	| { reason: "GOOGLE_CALENDAR_RATE_LIMITED" }
	| { reason: "GOOGLE_CALENDAR_SYNC_FAILED" };

type GoogleCalendarErrorCode<
	T extends GoogleCalendarFallbackErrorCode = GoogleCalendarFallbackErrorCode
> = "GOOGLE_CALENDAR_AUTH_FAILED" | "GOOGLE_CALENDAR_RATE_LIMITED" | T;

const googleCalendarErrorSchema = z.object({
	message: z.string().optional(),
	response: z.object({ status: z.number().optional() }).optional()
});

// map raw Google API errors to the app error codes we expose upstream
export function getGoogleCalendarErrorCode<T extends GoogleCalendarFallbackErrorCode>(
	error: unknown,
	fallbackCode: T
): GoogleCalendarErrorCode<T> {
	const parsedError = googleCalendarErrorSchema.safeParse(error);
	if (!parsedError.success) return fallbackCode;

	if (parsedError.data.message?.includes("invalid_grant")) {
		return "GOOGLE_CALENDAR_AUTH_FAILED";
	}

	const status = parsedError.data.response?.status;

	if (status === 401 || status === 403) {
		return "GOOGLE_CALENDAR_AUTH_FAILED";
	}

	if (status === 429) {
		return "GOOGLE_CALENDAR_RATE_LIMITED";
	}

	return fallbackCode;
}

export function isGoogleCalendarEventNotFoundError(error: unknown) {
	const parsedError = googleCalendarErrorSchema.safeParse(error);
	if (!parsedError.success) return false;

	const status = parsedError.data.response?.status;
	return status === 404 || status === 410;
}
