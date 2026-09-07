import { ResultAsync } from "neverthrow";
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

export const googleCalendarErrorSchema = z.object({
	message: z.string().optional(),
	response: z.object({ status: z.number().optional() }).optional()
});

export type ParsedGoogleCalendarError = z.infer<typeof googleCalendarErrorSchema>;

export function googleCalendarErrorCodeFromParsed<T extends GoogleCalendarFallbackErrorCode>(
	error: ParsedGoogleCalendarError,
	fallbackCode: T
): GoogleCalendarErrorCode<T> {
	if (error.message?.includes("invalid_grant")) {
		return "GOOGLE_CALENDAR_AUTH_FAILED";
	}

	const status = error.response?.status;

	if (status === 401 || status === 403) {
		return "GOOGLE_CALENDAR_AUTH_FAILED";
	}

	if (status === 429) {
		return "GOOGLE_CALENDAR_RATE_LIMITED";
	}

	return fallbackCode;
}

export function isGoogleCalendarEventNotFoundFromParsed(error: ParsedGoogleCalendarError) {
	const status = error.response?.status;
	return status === 404 || status === 410;
}

export function googleCalendarErrorFromParseResult<T extends GoogleCalendarFallbackErrorCode>(
	fallbackCode: T,
	parsedError: ReturnType<typeof googleCalendarErrorSchema.safeParse>
) {
	const reason = parsedError.success
		? googleCalendarErrorCodeFromParsed(parsedError.data, fallbackCode)
		: fallbackCode;

	return { reason };
}

export function resultAsyncFromGoogleCalendarPromise<T, F extends GoogleCalendarFallbackErrorCode>(
	promise: Promise<T>,
	fallbackCode: F
) {
	return ResultAsync.fromPromise(promise, (error) =>
		googleCalendarErrorFromParseResult(fallbackCode, googleCalendarErrorSchema.safeParse(error))
	);
}
