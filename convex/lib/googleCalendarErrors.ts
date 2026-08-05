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

// narrow unknown thrown values before reading nested properties
function isObject(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null;
}

// map raw Google API errors to the app error codes we expose upstream
export function getGoogleCalendarErrorCode<T extends GoogleCalendarFallbackErrorCode>(
	error: unknown,
	fallbackCode: T
): GoogleCalendarErrorCode<T> {
	if (!isObject(error)) {
		return fallbackCode;
	}

	const message = typeof error.message === "string" ? error.message : "";
	if (message.includes("invalid_grant")) {
		return "GOOGLE_CALENDAR_AUTH_FAILED";
	}

	const response = isObject(error.response) ? error.response : null;
	const status = typeof response?.status === "number" ? response.status : null;

	if (status === 401 || status === 403) {
		return "GOOGLE_CALENDAR_AUTH_FAILED";
	}

	if (status === 429) {
		return "GOOGLE_CALENDAR_RATE_LIMITED";
	}

	return fallbackCode;
}

export function isGoogleCalendarEventNotFoundError(error: unknown) {
	if (!isObject(error)) {
		return false;
	}

	const response = isObject(error.response) ? error.response : null;
	const status = typeof response?.status === "number" ? response.status : null;

	return status === 404 || status === 410;
}
