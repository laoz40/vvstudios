import type { RescheduleLinkLookupError } from "#convex/sessionReschedule";
import type { FunctionReturnType } from "convex/server";
import { api } from "#convex/_generated/api";
import type { UnexpectedError } from "#/lib/result";
import type { DevRescheduleUpdateError } from "#studio/components/booking/RescheduleDevScenarioPanel";

export type RescheduleLinkInvalidContent = { title: string; description: string };

type RescheduleAvailabilityError =
	| Exclude<
			NonNullable<
				FunctionReturnType<typeof api.googleCalendar.getRescheduleBookableRangeBusyWindows>[0]
			>,
			RescheduleLinkLookupError
	  >
	| UnexpectedError;

type RescheduleUpdateToastError =
	| NonNullable<FunctionReturnType<typeof api.googleCalendar.rescheduleSession>[0]>
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

const rescheduleUpdateToastMessages = {
	RESCHEDULE_LINK_NOT_FOUND: "This reschedule link could not be found.",
	RESCHEDULE_LINK_USED: "This reschedule link has already been used.",
	RESCHEDULE_LINK_EXPIRED: "This reschedule link has expired.",
	BOOKING_NOT_FOUND: "We could not find this booking.",
	BOOKING_NOT_RESCHEDULABLE: "This booking can’t be rescheduled online.",
	BOOKING_INVALID_DATE: "Please choose a valid date.",
	BOOKING_INVALID_TIME: "Please choose a valid time.",
	BOOKING_INVALID_INPUT:
		"This booking can’t be updated from this link. Please contact us for help.",
	BOOKING_TIME_UNAVAILABLE: "That time is no longer available. Please choose another time.",
	GOOGLE_CALENDAR_AUTH_FAILED:
		"We couldn’t update the calendar. Please contact us and we’ll help you.",
	GOOGLE_CALENDAR_AVAILABILITY_FAILED:
		"We couldn’t update the calendar. Please contact us and we’ll help you.",
	GOOGLE_CALENDAR_CREATE_FAILED:
		"We couldn’t update the calendar. Please contact us and we’ll help you.",
	GOOGLE_CALENDAR_UPDATE_FAILED:
		"We couldn’t update the calendar. Please contact us and we’ll help you.",
	BOOKING_RATE_LIMITED: "Too many reschedule attempts. Please wait a moment and try again.",
	GOOGLE_CALENDAR_RATE_LIMITED: "Calendar is temporarily busy. Please wait a moment and try again.",
	UNEXPECTED_ERROR: "Something went wrong while updating your booking."
} satisfies Record<RescheduleUpdateToastError["reason"], string>;

export function getRescheduleUpdateToastMessage(error: RescheduleUpdateToastError): string {
	return rescheduleUpdateToastMessages[error.reason];
}
