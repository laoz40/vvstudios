interface BookingErrorWithData {
	data?: {
		code?: string;
		retryAfter?: number;
	};
}

export type BookingSubmitFailureResult =
	| {
			code: "BOOKING_RATE_LIMITED";
			ok: false;
			retryAfter: number;
	  }
	| {
			code: "BOOKING_EMAIL_DOMAIN_INVALID";
			ok: false;
	  };

export function getBookingSubmitFailureMessage(result: BookingSubmitFailureResult) {
	if (result.code === "BOOKING_EMAIL_DOMAIN_INVALID") {
		return "This email domain doesn't appear able to receive email. Please check for typos.";
	}

	return "Too many booking attempts. Please try again in one minute.";
}

export function getBookingErrorMessage(error: unknown) {
	const errorWithData =
		typeof error === "object" && error !== null ? (error as BookingErrorWithData) : null;
	const code = errorWithData?.data?.code;

	if (code === "BOOKING_TIME_UNAVAILABLE") {
		return "That time was just taken. Please choose another available time.";
	}

	if (code === "BOOKING_INVALID_INPUT") {
		return "Some booking details were invalid. Please review the form and try again.";
	}

	if (code === "BOOKING_EMAIL_DOMAIN_INVALID") {
		return "This email domain doesn't appear able to receive email. Please check for typos.";
	}

	if (code === "BOOKING_RATE_LIMITED") {
		return "Too many booking attempts. Please try again in one minute.";
	}

	if (code === "GOOGLE_CALENDAR_AUTH_FAILED") {
		return "Google Calendar authentication failed. Regenerate the refresh token and try again.";
	}

	if (code === "GOOGLE_CALENDAR_AVAILABILITY_FAILED") {
		return "Could not load availability right now. Check the Convex logs for the Google error details.";
	}

	if (code === "GOOGLE_CALENDAR_RATE_LIMITED") {
		return "Calendar availability was refreshed too many times. Please wait a minute and try again.";
	}

	return error instanceof Error ? error.message : "Something went wrong.";
}
