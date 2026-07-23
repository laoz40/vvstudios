import type {
	CreatePackageSessionResult,
	GetPackageByTokenResult,
	SetDefaultSpaceResult,
	ReschedulePackageSessionResult,
	UnschedulePackageSessionResult
} from "#convex/packageScheduling";
import type { GetPackageBusyWindowsResult } from "#convex/packageSchedulingCalendar";
import type { UnexpectedError } from "#/lib/result";

type PackageLookupError = NonNullable<GetPackageByTokenResult[0]>;
type PackageBusyWindowsError = NonNullable<GetPackageBusyWindowsResult[0]> | UnexpectedError;
type SaveDefaultSpaceError = NonNullable<SetDefaultSpaceResult[0]> | UnexpectedError;
type SavePackageBookingError =
	| NonNullable<CreatePackageSessionResult[0]>
	| NonNullable<ReschedulePackageSessionResult[0]>
	| UnexpectedError;
type UnschedulePackageSessionError =
	| NonNullable<UnschedulePackageSessionResult[0]>
	| UnexpectedError;

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

export function getSaveDefaultSpaceToastMessage(error: SaveDefaultSpaceError) {
	switch (error.reason) {
		case "PACKAGE_LINK_INVALID":
		case "PACKAGE_LINK_EXPIRED":
		case "PACKAGE_LINK_INACTIVE":
		case "PACKAGE_NOT_PAID":
			return getPackageLinkInvalidMessage(error).description;
		case "UNEXPECTED_ERROR":
			return "Could not save your default recording space. Please try again.";
		default: {
			const _exhaustive: never = error;
			return _exhaustive;
		}
	}
}

type SavePackageBookingMessage = string | ((noticeWindowLabel: string) => string);

const savePackageBookingMessages = {
	PACKAGE_LINK_INVALID: "Please use the scheduling link from your latest VV Studios email.",
	PACKAGE_LINK_EXPIRED: "This package scheduling window has ended.",
	PACKAGE_LINK_INACTIVE: "Please contact VV Studios if you need help with your package.",
	PACKAGE_NOT_PAID: "Packages can be scheduled after payment is confirmed.",
	PACKAGE_CAPACITY_EXCEEDED: "All sessions in this package are already scheduled.",
	PACKAGE_BOOKING_NOT_FOUND: "This package session could not be found.",
	BOOKING_NOT_FOUND: "This package session could not be found.",
	PACKAGE_BOOKING_LOCKED: (noticeWindowLabel: string) =>
		`This session can only be changed more than ${noticeWindowLabel} before it starts.`,
	BOOKING_INVALID_DATE: "Please choose a valid date.",
	BOOKING_INVALID_DURATION: "This package has an invalid session duration.",
	BOOKING_INVALID_TIME: "Please choose a valid time.",
	BOOKING_OUTSIDE_OPENING_HOURS: "Please choose a time within opening hours.",
	BOOKING_TOO_FAR_AHEAD: "Please choose a date before your package expiry date.",
	BOOKING_TOO_SOON: "Please choose a later time.",
	BOOKING_TIME_UNAVAILABLE: "That time was just booked. Please choose another time.",
	BOOKING_RATE_LIMITED: "Too many session updates. Please wait a minute and try again.",
	GOOGLE_CALENDAR_AUTH_FAILED: "Calendar access failed. Please try again later.",
	GOOGLE_CALENDAR_SYNC_FAILED: "Could not update the calendar event. Please try again.",
	GOOGLE_CALENDAR_RATE_LIMITED:
		"Availability was checked too many times. Please wait a minute and try again.",
	PACKAGE_BOOKING_SAVE_FAILED: "Could not save this session. Please try again.",
	UNEXPECTED_ERROR: "Something went wrong while saving this session."
} satisfies Record<SavePackageBookingError["reason"], SavePackageBookingMessage>;

export function getSavePackageBookingToastMessage(
	error: SavePackageBookingError,
	noticeWindowLabel: string
) {
	const message = savePackageBookingMessages[error.reason];
	return typeof message === "function" ? message(noticeWindowLabel) : message;
}

export function getUnschedulePackageBookingToastMessage(
	error: UnschedulePackageSessionError,
	noticeWindowLabel: string
) {
	switch (error.reason) {
		case "PACKAGE_LINK_INVALID":
		case "PACKAGE_LINK_EXPIRED":
		case "PACKAGE_LINK_INACTIVE":
		case "PACKAGE_NOT_PAID":
			return getPackageLinkInvalidMessage(error).description;
		case "PACKAGE_BOOKING_NOT_FOUND":
			return "This package session could not be found.";
		case "PACKAGE_BOOKING_LOCKED":
			return `This session can only be unscheduled more than ${noticeWindowLabel} before it starts.`;
		case "GOOGLE_CALENDAR_AUTH_FAILED":
			return "Calendar access failed. Please try again later.";
		case "GOOGLE_CALENDAR_SYNC_FAILED":
			return "Could not remove the calendar event. Please try again.";
		case "GOOGLE_CALENDAR_RATE_LIMITED":
			return "Calendar updates are busy. Please wait a minute and try again.";
		case "PACKAGE_BOOKING_CANCEL_FAILED":
			return "Could not unschedule this session. Please try again.";
		case "UNEXPECTED_ERROR":
			return "Something went wrong while unscheduling this session.";
		default: {
			const _exhaustive: never = error;
			return _exhaustive;
		}
	}
}
