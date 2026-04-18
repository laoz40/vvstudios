type GoogleCalendarFallbackErrorCode =
	| "GOOGLE_CALENDAR_AVAILABILITY_FAILED"
	| "GOOGLE_CALENDAR_CREATE_FAILED";

export type GoogleCalendarErrorCode =
	| "GOOGLE_CALENDAR_AUTH_FAILED"
	| GoogleCalendarFallbackErrorCode;

// narrow unknown thrown values before reading nested properties
function isObject(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null;
}

// map raw Google API errors to the app error codes we expose upstream
export function getGoogleCalendarErrorCode(
	error: unknown,
	fallbackCode: GoogleCalendarFallbackErrorCode,
): GoogleCalendarErrorCode {
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

	return fallbackCode;
}

// extract the most useful Google error fields for structured logging
export function getGoogleCalendarErrorDetails(error: unknown) {
	if (!isObject(error)) {
		return { error };
	}

	const response = isObject(error.response) ? error.response : null;
	const responseData = response && "data" in response ? response.data : undefined;

	return {
		message: typeof error.message === "string" ? error.message : undefined,
		stack: typeof error.stack === "string" ? error.stack : undefined,
		responseData,
		status: typeof response?.status === "number" ? response.status : undefined,
	};
}
