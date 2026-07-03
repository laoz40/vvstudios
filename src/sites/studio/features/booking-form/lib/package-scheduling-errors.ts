import type {
	ClearPackageSlotResult,
	GetPackageByTokenResult,
	SavePackageSlotResult
} from "#convex/packageScheduling";
import type { GetPackageBusyWindowsResult } from "#convex/packageSchedulingCalendar";
import type { UnexpectedError } from "#/lib/result";

type PackageLookupError = NonNullable<GetPackageByTokenResult[0]>;
type PackageBusyWindowsError = NonNullable<GetPackageBusyWindowsResult[0]> | UnexpectedError;
type SavePackageSlotError = NonNullable<SavePackageSlotResult[0]> | UnexpectedError;
type ClearPackageSlotError = NonNullable<ClearPackageSlotResult[0]> | UnexpectedError;

export function getPackageLinkInvalidMessage(error: PackageLookupError) {
	switch (error.reason) {
		case "PACKAGE_LINK_INVALID":
			return {
				title: "This package link is no longer valid.",
				description: "Please use the scheduling link from your latest VV Studios email."
			};
		case "PACKAGE_LINK_EXPIRED":
			return {
				title: "This package link has expired.",
				description: "This package scheduling window has ended."
			};
		case "PACKAGE_LINK_INACTIVE":
			return {
				title: "This package link is inactive.",
				description: "Please contact VV Studios if you need help with your package."
			};
		case "PACKAGE_NOT_PAID":
			return {
				title: "This package is not ready for scheduling.",
				description: "Packages can be scheduled after payment is confirmed."
			};
		default: {
			const _exhaustive: never = error;
			return _exhaustive;
		}
	}
}

export function getPackageAvailabilityErrorMessage(error: PackageBusyWindowsError) {
	switch (error.reason) {
		case "PACKAGE_LINK_INVALID":
		case "PACKAGE_LINK_EXPIRED":
		case "PACKAGE_LINK_INACTIVE":
		case "PACKAGE_NOT_PAID":
			return getPackageLinkInvalidMessage(error).description;
		case "GOOGLE_CALENDAR_AUTH_FAILED":
			return "Calendar access failed. Please try again later.";
		case "GOOGLE_CALENDAR_AVAILABILITY_FAILED":
			return "Availability could not be loaded. Please try again.";
		case "GOOGLE_CALENDAR_RATE_LIMITED":
			return "Availability was checked too many times. Please wait a minute and try again.";
		case "UNEXPECTED_ERROR":
			return "Something went wrong while loading availability.";
		default: {
			const _exhaustive: never = error;
			return _exhaustive;
		}
	}
}

export function getSavePackageSlotToastMessage(
	error: SavePackageSlotError,
	noticeWindowLabel: string
) {
	switch (error.reason) {
		case "PACKAGE_LINK_INVALID":
		case "PACKAGE_LINK_EXPIRED":
		case "PACKAGE_LINK_INACTIVE":
		case "PACKAGE_NOT_PAID":
			return getPackageLinkInvalidMessage(error).description;
		case "PACKAGE_SLOT_NOT_FOUND":
			return "This session slot could not be found.";
		case "PACKAGE_SLOT_LOCKED":
			return `This session can only be changed more than ${noticeWindowLabel} before it starts.`;
		case "BOOKING_INVALID_DATE":
			return "Please choose a valid date.";
		case "BOOKING_INVALID_DURATION":
			return "This package has an invalid session duration.";
		case "BOOKING_INVALID_TIME":
			return "Please choose a valid time.";
		case "BOOKING_OUTSIDE_OPENING_HOURS":
			return "Please choose a time within opening hours.";
		case "BOOKING_TOO_FAR_AHEAD":
			return "Please choose a date before your package expiry date.";
		case "BOOKING_TOO_SOON":
			return "Please choose a later time.";
		case "BOOKING_TIME_UNAVAILABLE":
			return "That time was just booked. Please choose another time.";
		case "GOOGLE_CALENDAR_AUTH_FAILED":
			return "Calendar access failed. Please try again later.";
		case "GOOGLE_CALENDAR_CREATE_FAILED":
		case "GOOGLE_CALENDAR_UPDATE_FAILED":
			return "Could not update the calendar event. Please try again.";
		case "GOOGLE_CALENDAR_RATE_LIMITED":
			return "Availability was checked too many times. Please wait a minute and try again.";
		case "PACKAGE_SLOT_SAVE_FAILED":
			return "Could not save this session. Please try again.";
		case "UNEXPECTED_ERROR":
			return "Something went wrong while saving this session.";
		default: {
			const _exhaustive: never = error;
			return _exhaustive;
		}
	}
}

export function getClearPackageSlotToastMessage(
	error: ClearPackageSlotError,
	noticeWindowLabel: string
) {
	switch (error.reason) {
		case "PACKAGE_LINK_INVALID":
		case "PACKAGE_LINK_EXPIRED":
		case "PACKAGE_LINK_INACTIVE":
		case "PACKAGE_NOT_PAID":
			return getPackageLinkInvalidMessage(error).description;
		case "PACKAGE_SLOT_NOT_FOUND":
			return "This session slot could not be found.";
		case "PACKAGE_SLOT_LOCKED":
			return `This session can only be cleared more than ${noticeWindowLabel} before it starts.`;
		case "GOOGLE_CALENDAR_AUTH_FAILED":
			return "Calendar access failed. Please try again later.";
		case "GOOGLE_CALENDAR_DELETE_FAILED":
			return "Could not remove the calendar event. Please try again.";
		case "GOOGLE_CALENDAR_RATE_LIMITED":
			return "Calendar updates are busy. Please wait a minute and try again.";
		case "PACKAGE_SLOT_CLEAR_FAILED":
			return "Could not clear this session. Please try again.";
		case "UNEXPECTED_ERROR":
			return "Something went wrong while clearing this session.";
		default: {
			const _exhaustive: never = error;
			return _exhaustive;
		}
	}
}
