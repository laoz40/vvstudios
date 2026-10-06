import type { ResultAsync } from "neverthrow";
import { z } from "zod";

import { tryPromise } from "#convex/lib/result";

export type CalendarFallbackCode =
	| "GOOGLE_CALENDAR_AVAILABILITY_FAILED"
	| "GOOGLE_CALENDAR_CREATE_FAILED"
	| "GOOGLE_CALENDAR_DELETE_FAILED"
	| "GOOGLE_CALENDAR_SYNC_FAILED"
	| "GOOGLE_CALENDAR_UPDATE_FAILED";

export type GoogleCalendarWriteError =
	| { reason: "GOOGLE_CALENDAR_AUTH_FAILED" }
	| { reason: "GOOGLE_CALENDAR_RATE_LIMITED" }
	| { reason: CalendarFallbackCode };

type GoogleCalendarErrorCode<T extends CalendarFallbackCode = CalendarFallbackCode> =
	| "GOOGLE_CALENDAR_AUTH_FAILED"
	| "GOOGLE_CALENDAR_RATE_LIMITED"
	| T;

export const calendarErrorSchema = z.object({
	message: z.string().optional(),
	response: z.object({ status: z.number().optional() }).optional()
});

export type CalendarApiError = z.infer<typeof calendarErrorSchema>;

export type GoogleCalendarAvailabilityError = {
	reason: GoogleCalendarErrorCode<"GOOGLE_CALENDAR_AVAILABILITY_FAILED">;
};

export function googleCalendarAvailabilityErrorFromCause(
	cause: CalendarApiError
): GoogleCalendarAvailabilityError {
	return {
		reason: mapCalendarErrorCode(cause, "GOOGLE_CALENDAR_AVAILABILITY_FAILED")
	} satisfies GoogleCalendarAvailabilityError;
}

export function tryGoogleCalendarAvailability<T>(
	tryFn: () => Promise<T>
): ResultAsync<T, GoogleCalendarAvailabilityError> {
	return tryPromise({
		try: tryFn,
		catch: (cause) => {
			const parsedError = calendarErrorSchema.safeParse(cause);

			return parsedError.success
				? googleCalendarAvailabilityErrorFromCause(parsedError.data)
				: { reason: "GOOGLE_CALENDAR_AVAILABILITY_FAILED" };
		}
	});
}

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
