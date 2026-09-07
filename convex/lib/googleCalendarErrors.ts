import { ResultAsync } from "neverthrow";
import { z } from "zod";

export type CalendarFallbackCode =
	| "GOOGLE_CALENDAR_AVAILABILITY_FAILED"
	| "GOOGLE_CALENDAR_CREATE_FAILED"
	| "GOOGLE_CALENDAR_DELETE_FAILED"
	| "GOOGLE_CALENDAR_SYNC_FAILED"
	| "GOOGLE_CALENDAR_UPDATE_FAILED";

export type GoogleCalendarWriteError =
	| { reason: "GOOGLE_CALENDAR_AUTH_FAILED" }
	| { reason: "GOOGLE_CALENDAR_RATE_LIMITED" }
	| { reason: "GOOGLE_CALENDAR_SYNC_FAILED" };

type GoogleCalendarErrorCode<T extends CalendarFallbackCode = CalendarFallbackCode> =
	| "GOOGLE_CALENDAR_AUTH_FAILED"
	| "GOOGLE_CALENDAR_RATE_LIMITED"
	| T;

export const calendarErrorSchema = z.object({
	message: z.string().optional(),
	response: z.object({ status: z.number().optional() }).optional()
});

export type CalendarApiError = z.infer<typeof calendarErrorSchema>;

export function mapCalendarErrorCode<T extends CalendarFallbackCode>(
	error: CalendarApiError,
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

export function isCalendarEventNotFound(error: CalendarApiError) {
	const status = error.response?.status;
	return status === 404 || status === 410;
}

export function calendarResultAsync<T, F extends CalendarFallbackCode>(
	promise: Promise<T>,
	fallbackCode: F
) {
	return ResultAsync.fromPromise(promise, (error) => {
		const parsedError = calendarErrorSchema.safeParse(error);
		const reason = parsedError.success
			? mapCalendarErrorCode(parsedError.data, fallbackCode)
			: fallbackCode;

		return { reason };
	});
}
