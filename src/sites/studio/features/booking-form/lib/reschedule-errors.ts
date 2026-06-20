import type { RescheduleLinkLookupError } from "#convex/bookingReschedule";
import type {
	GetRescheduleBookableRangeBusyWindowsResult,
	RescheduleBookingResult
} from "#convex/googleCalendar";
import type { UnexpectedError } from "#/lib/result";
import type { DevRescheduleUpdateError } from "#studio/components/booking/RescheduleDevScenarioPanel";

export type RescheduleLinkInvalidContent = { title: string; description: string };

type RescheduleAvailabilityError =
	| Exclude<NonNullable<GetRescheduleBookableRangeBusyWindowsResult[0]>, RescheduleLinkLookupError>
	| UnexpectedError;

type RescheduleUpdateToastError =
	| NonNullable<RescheduleBookingResult[0]>
	| DevRescheduleUpdateError;

export function getInvalidMessage(error: RescheduleLinkLookupError): RescheduleLinkInvalidContent {
	switch (error.reason) {
		case "RESCHEDULE_LINK_NOT_FOUND":
			return {
				title: "This reschedule link could not be found.",
				description: "Please use the reschedule button in your latest invoice email."
			};

		case "RESCHEDULE_LINK_USED":
			return {
				title: "This reschedule link has already been used.",
				description: "Please use the newest reschedule link from your latest invoice email."
			};

		case "RESCHEDULE_LINK_EXPIRED":
			return {
				title: "This reschedule link has expired.",
				description: "Please contact us if you still need to move your session."
			};

		case "BOOKING_NOT_FOUND":
			return {
				title: "We could not find this booking.",
				description: "Please contact us and we’ll help you reschedule your session."
			};

		case "BOOKING_NOT_RESCHEDULABLE":
			return {
				title: "This booking can’t be rescheduled online.",
				description: "Please contact us and we’ll help you with your booking."
			};

		default: {
			const _exhaustive: never = error;
			return _exhaustive;
		}
	}
}

export function getAvailabilityErrorMessage(error: RescheduleAvailabilityError): string {
	switch (error.reason) {
		case "GOOGLE_CALENDAR_AUTH_FAILED":
		case "GOOGLE_CALENDAR_AVAILABILITY_FAILED":
			return "Availability could not load right now. Please contact us and we’ll help you find a time.";

		case "GOOGLE_CALENDAR_RATE_LIMITED":
			return "Availability is temporarily busy. Please wait a moment and try again.";

		case "UNEXPECTED_ERROR":
			return "Something went wrong while loading availability. Please try again.";

		default: {
			const _exhaustive: never = error;
			return _exhaustive;
		}
	}
}

export function getRescheduleUpdateToastMessage(error: RescheduleUpdateToastError): string {
	switch (error.reason) {
		case "RESCHEDULE_LINK_NOT_FOUND":
		case "RESCHEDULE_LINK_USED":
		case "RESCHEDULE_LINK_EXPIRED":
		case "BOOKING_NOT_FOUND":
		case "BOOKING_NOT_RESCHEDULABLE":
			return getInvalidMessage(error).title;

		case "BOOKING_INVALID_DATE":
			return "Please choose a valid date.";

		case "BOOKING_INVALID_TIME":
			return "Please choose a valid time.";

		case "BOOKING_TIME_UNAVAILABLE":
			return "That time is no longer available. Please choose another time.";

		case "GOOGLE_CALENDAR_AUTH_FAILED":
		case "GOOGLE_CALENDAR_AVAILABILITY_FAILED":
		case "GOOGLE_CALENDAR_CREATE_FAILED":
		case "GOOGLE_CALENDAR_UPDATE_FAILED":
			return "We couldn’t update the calendar. Please contact us and we’ll help you.";

		case "BOOKING_RATE_LIMITED":
			return "Too many reschedule attempts. Please wait a moment and try again.";

		case "GOOGLE_CALENDAR_RATE_LIMITED":
			return "Calendar is temporarily busy. Please wait a moment and try again.";

		case "UNEXPECTED_ERROR":
			return "Something went wrong while updating your booking.";

		default: {
			const _exhaustive: never = error;
			return _exhaustive;
		}
	}
}
