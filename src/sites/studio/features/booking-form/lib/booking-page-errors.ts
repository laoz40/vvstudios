import type { GetBookableRangeBusyWindowsResult } from "#convex/googleCalendar";
import type { CreatePackageRequestResult } from "#convex/packagePayment";
import type {
	CloseEmbeddedCheckoutSessionResult,
	CreateEmbeddedCheckoutSessionResult
} from "#convex/stripe";
import type { UnexpectedError } from "#/lib/result";
import type { BookDevErrorCode } from "#studio/components/booking/BookDevErrorPanel";

const bookingPageErrorMessages = {
	BOOKING_EMAIL_DOMAIN_INVALID:
		"This email domain doesn't appear able to receive email. Please check for typos.",
	BOOKING_INVALID_DATE: "Choose a valid booking date.",
	BOOKING_INVALID_DURATION: "Choose a valid booking duration.",
	BOOKING_INVALID_INPUT: "Some booking details were invalid. Please review the form and try again.",
	BOOKING_INVALID_TIME: "Choose a valid booking time.",
	BOOKING_OUTSIDE_OPENING_HOURS:
		"That time is outside our opening hours. Please choose another time.",
	BOOKING_RATE_LIMITED: "Too many booking attempts. Please try again in one minute.",
	BOOKING_TIME_UNAVAILABLE: "That time was just taken. Please choose another available time.",
	BOOKING_TOO_FAR_AHEAD: "That date is too far ahead. Please choose a closer date.",
	BOOKING_TOO_SOON: "That time is too soon. Please choose a later slot.",
	CLOSE_CHECKOUT_FAILED: "Something went wrong while closing checkout.",
	GOOGLE_CALENDAR_AUTH_FAILED:
		"We couldn't load booking times right now. Please refresh or contact us if this keeps happening.",
	GOOGLE_CALENDAR_AVAILABILITY_FAILED:
		"We couldn't load booking times right now. Please refresh or try again soon.",
	GOOGLE_CALENDAR_RATE_LIMITED:
		"Booking times are being checked too often. Please wait a minute, then try again.",
	LOAD_AVAILABILITY_FAILED: "Something went wrong while loading availability.",
	START_CHECKOUT_FAILED: "Something went wrong while starting checkout.",
	STRIPE_CHECKOUT_CLOSE_FAILED: "Failed to close checkout.",
	STRIPE_SESSION_MISMATCH:
		"We couldn’t close this checkout session safely. Please refresh the page and try again.",
	UNKNOWN: "Something went wrong."
} as const;

type StartCheckoutToastError =
	| NonNullable<CreateEmbeddedCheckoutSessionResult[0]>
	| UnexpectedError;

type CloseCheckoutToastError = NonNullable<CloseEmbeddedCheckoutSessionResult[0]> | UnexpectedError;
type AvailabilityToastError = NonNullable<GetBookableRangeBusyWindowsResult[0]> | UnexpectedError;
type CreateMultiBookingToastError = NonNullable<CreatePackageRequestResult[0]> | UnexpectedError;

export const devBookingErrorMessages = {
	BOOKING_INVALID_INPUT: bookingPageErrorMessages.BOOKING_INVALID_INPUT,
	BOOKING_TIME_UNAVAILABLE: bookingPageErrorMessages.BOOKING_TIME_UNAVAILABLE,
	GOOGLE_CALENDAR_AUTH_FAILED: bookingPageErrorMessages.GOOGLE_CALENDAR_AUTH_FAILED,
	GOOGLE_CALENDAR_AVAILABILITY_FAILED: bookingPageErrorMessages.GOOGLE_CALENDAR_AVAILABILITY_FAILED,
	GOOGLE_CALENDAR_RATE_LIMITED: bookingPageErrorMessages.GOOGLE_CALENDAR_RATE_LIMITED,
	UNKNOWN: bookingPageErrorMessages.UNKNOWN
} satisfies Record<BookDevErrorCode, string>;

export const startCheckoutToastMessages = {
	BOOKING_EMAIL_DOMAIN_INVALID: bookingPageErrorMessages.BOOKING_EMAIL_DOMAIN_INVALID,
	BOOKING_INVALID_DATE: bookingPageErrorMessages.BOOKING_INVALID_DATE,
	BOOKING_INVALID_DURATION: bookingPageErrorMessages.BOOKING_INVALID_DURATION,
	BOOKING_INVALID_INPUT: bookingPageErrorMessages.BOOKING_INVALID_INPUT,
	BOOKING_INVALID_TIME: bookingPageErrorMessages.BOOKING_INVALID_TIME,
	BOOKING_OUTSIDE_OPENING_HOURS: bookingPageErrorMessages.BOOKING_OUTSIDE_OPENING_HOURS,
	BOOKING_RATE_LIMITED: bookingPageErrorMessages.BOOKING_RATE_LIMITED,
	BOOKING_TIME_UNAVAILABLE: bookingPageErrorMessages.BOOKING_TIME_UNAVAILABLE,
	BOOKING_TOO_FAR_AHEAD: bookingPageErrorMessages.BOOKING_TOO_FAR_AHEAD,
	BOOKING_TOO_SOON: bookingPageErrorMessages.BOOKING_TOO_SOON,
	UNEXPECTED_ERROR: bookingPageErrorMessages.START_CHECKOUT_FAILED
} satisfies Record<StartCheckoutToastError["reason"], string>;

export const createMultiBookingToastMessages = {
	BOOKING_EMAIL_DOMAIN_INVALID: bookingPageErrorMessages.BOOKING_EMAIL_DOMAIN_INVALID,
	BOOKING_INVALID_INPUT: bookingPageErrorMessages.BOOKING_INVALID_INPUT,
	BOOKING_RATE_LIMITED: bookingPageErrorMessages.BOOKING_RATE_LIMITED,
	UNEXPECTED_ERROR: "Something went wrong while creating your package request."
} satisfies Record<CreateMultiBookingToastError["reason"], string>;

export const closeCheckoutToastMessages = {
	STRIPE_CHECKOUT_CLOSE_FAILED: bookingPageErrorMessages.STRIPE_CHECKOUT_CLOSE_FAILED,
	STRIPE_SESSION_MISMATCH: bookingPageErrorMessages.STRIPE_SESSION_MISMATCH,
	UNEXPECTED_ERROR: bookingPageErrorMessages.CLOSE_CHECKOUT_FAILED
} satisfies Record<CloseCheckoutToastError["reason"], string>;

export const availabilityErrorMessages = {
	GOOGLE_CALENDAR_AUTH_FAILED: bookingPageErrorMessages.GOOGLE_CALENDAR_AUTH_FAILED,
	GOOGLE_CALENDAR_AVAILABILITY_FAILED: bookingPageErrorMessages.GOOGLE_CALENDAR_AVAILABILITY_FAILED,
	GOOGLE_CALENDAR_RATE_LIMITED: bookingPageErrorMessages.GOOGLE_CALENDAR_RATE_LIMITED,
	UNEXPECTED_ERROR: bookingPageErrorMessages.LOAD_AVAILABILITY_FAILED
} satisfies Record<AvailabilityToastError["reason"], string>;
