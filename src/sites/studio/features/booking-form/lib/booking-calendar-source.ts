import type { UseQueryResult } from "@tanstack/react-query";
import { z } from "zod";
import { exhaustiveCheck } from "#/lib/result";
import {
	getDevRescheduleAvailabilityStatus,
	type DevRescheduleScenario
} from "#studio/components/booking/RescheduleDevScenarioPanel";
import {
	getAvailabilityWindows,
	type AvailabilityState
} from "#studio/features/booking-form/lib/availability-picker-machine";
import { availabilityErrorMessages } from "#studio/features/booking-form/lib/booking-page-errors";
import type { BusyWindowsByMonth } from "#studio/features/booking-form/lib/monthly-availability";
import {
	getAvailabilityErrorMessage,
	isRescheduleBusyWindowsLoadError,
	resolveRescheduleBusyWindowsLoadError,
	type RescheduleBusyWindowsLoadError
} from "#studio/features/booking-form/lib/reschedule-errors";

export type BookingCalendarSource =
	| { kind: "booking" }
	| { kind: "reschedule"; token: string; devScenario?: DevRescheduleScenario };

const bookingLoadErrorSchema = z.object({
	reason: z.enum([
		"GOOGLE_CALENDAR_AUTH_FAILED",
		"GOOGLE_CALENDAR_AVAILABILITY_FAILED",
		"GOOGLE_CALENDAR_RATE_LIMITED",
		"UNEXPECTED_ERROR"
	])
});

function resolveCalendarLoadError({
	source,
	error,
	cachedWindows
}: {
	source: BookingCalendarSource;
	error: unknown;
	cachedWindows: BusyWindowsByMonth;
}): AvailabilityState {
	switch (source.kind) {
		case "booking": {
			const parsedError = bookingLoadErrorSchema.safeParse(error);
			const reason = parsedError.success ? parsedError.data.reason : "UNEXPECTED_ERROR";

			return {
				kind: "error",
				error: {
					reason: reason === "GOOGLE_CALENDAR_RATE_LIMITED" ? "rateLimited" : "unavailable",
					message: availabilityErrorMessages[reason]
				},
				cachedWindows
			};
		}

		case "reschedule": {
			const loadError: RescheduleBusyWindowsLoadError = isRescheduleBusyWindowsLoadError(error)
				? error
				: { reason: "UNEXPECTED_ERROR" };

			const outcome = resolveRescheduleBusyWindowsLoadError(loadError);

			if (outcome.kind === "invalidLink") {
				return { kind: "invalidLink", content: outcome.content };
			}

			return {
				kind: "error",
				error: {
					reason:
						loadError.reason === "GOOGLE_CALENDAR_RATE_LIMITED" ? "rateLimited" : "unavailable",
					message: outcome.message
				},
				cachedWindows
			};
		}

		default:
			return exhaustiveCheck(source);
	}
}

export function getCalendarAvailability({
	source,
	query
}: {
	source: BookingCalendarSource;
	query: UseQueryResult<BusyWindowsByMonth>;
}): AvailabilityState {
	if (source.kind === "reschedule" && source.devScenario) {
		const preview = getDevRescheduleAvailabilityStatus(source.devScenario);

		switch (preview.kind) {
			case "ready":
				return { kind: "preview", times: preview.times };
			case "availabilityError":
				return {
					kind: "error",
					error: {
						reason:
							preview.error.reason === "GOOGLE_CALENDAR_RATE_LIMITED"
								? "rateLimited"
								: "unavailable",
						message: getAvailabilityErrorMessage(preview.error)
					},
					cachedWindows: {}
				};
			case "linkStatus":
				// The page's booking lookup renders the development invalid-link screen.
				return { kind: "loading" };
			default:
				return exhaustiveCheck(preview);
		}
	}

	const status = query.status;

	switch (status) {
		case "pending":
			return { kind: "loading" };
		case "success":
			return { kind: "ready", windows: query.data };
		case "error":
			return resolveCalendarLoadError({
				source,
				error: query.error,
				cachedWindows: query.data ?? {}
			});
		default:
			return exhaustiveCheck(status);
	}
}

export function overrideCalendarError({
	availability,
	message
}: {
	availability: AvailabilityState;
	message: string;
}): AvailabilityState {
	if (!message) {
		return availability;
	}

	return {
		kind: "error",
		error: {
			reason:
				message === availabilityErrorMessages.GOOGLE_CALENDAR_RATE_LIMITED
					? "rateLimited"
					: "unavailable",
			message
		},
		cachedWindows: getAvailabilityWindows(availability)
	};
}
