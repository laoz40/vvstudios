function getConvexErrorCode(error: unknown) {
	if (typeof error !== "object" || error === null) {
		return undefined;
	}

	return "data" in error ? (error as { data?: { code?: string } }).data?.code : undefined;
}

export function getDeleteBookingErrorMessage(error: unknown) {
	switch (getConvexErrorCode(error)) {
		case "NOT_AUTHENTICATED":
			return "You are not signed in.";
		case "BOOKING_NOT_FOUND":
			return "That booking no longer exists.";
		case "GOOGLE_CALENDAR_EVENT_NOT_FOUND":
			return "Could not find the Google Calendar event. Booking was not deleted.";
		case "GOOGLE_CALENDAR_AUTH_FAILED":
			return "Google Calendar authentication failed. Booking was not deleted.";
		case "GOOGLE_CALENDAR_DELETE_FAILED":
			return "Could not delete the Google Calendar event. Booking was not deleted.";
		default:
			return "Unable to delete booking.";
	}
}

export function getBookingMutationErrorMessage(error: unknown) {
	switch (getConvexErrorCode(error)) {
		case "NOT_AUTHENTICATED":
			return "You are not signed in.";
		case "NOT_AUTHORIZED":
			return "You do not have access to edit bookings.";
		case "BOOKING_NOT_FOUND":
			return "That booking no longer exists.";
		case "BOOKING_INVALID_DATE":
			return "The booking date is invalid.";
		case "BOOKING_INVALID_DURATION":
			return "The booking duration is invalid.";
		case "BOOKING_INVALID_TIME":
			return "The booking time is invalid.";
		case "BOOKING_OUTSIDE_OPENING_HOURS":
			return "That booking time is outside opening hours.";
		case "BOOKING_TOO_FAR_AHEAD":
			return "The selected date is outside the allowed booking window.";
		case "BOOKING_TOO_SOON":
			return "The selected time does not meet the minimum notice period.";
		case "BOOKING_TIME_UNAVAILABLE":
			return "That time is unavailable. Choose another time.";
		case "GOOGLE_CALENDAR_AUTH_FAILED":
			return "Google Calendar authentication failed. Regenerate the refresh token and try again.";
		case "GOOGLE_CALENDAR_AVAILABILITY_FAILED":
			return "Could not check calendar availability. Please try again.";
		case "GOOGLE_CALENDAR_CREATE_FAILED":
			return "Could not create the Google Calendar event.";
		case "GOOGLE_CALENDAR_UPDATE_FAILED":
			return "Could not update the Google Calendar event. Booking changes were not saved.";
		case "GOOGLE_CALENDAR_RATE_LIMITED":
			return "Google Calendar was used too many times. Please wait a minute and try again.";
		default:
			return "Unable to save booking changes.";
	}
}

export function getBookingStatusMutationErrorMessage(error: unknown) {
	switch (getConvexErrorCode(error)) {
		case "NOT_AUTHENTICATED":
			return "You are not signed in.";
		case "BOOKING_NOT_FOUND":
			return "That booking no longer exists.";
		case "INVALID_BOOKING_STATUS_TRANSITION":
			return "Only confirmed and needs follow up bookings can be toggled here.";
		default:
			return "Unable to update booking status.";
	}
}

export function getBookingInvoiceEmailErrorMessage(error: unknown) {
	switch (getConvexErrorCode(error)) {
		case "NOT_AUTHENTICATED":
			return "You are not signed in.";
		case "NOT_AUTHORIZED":
			return "You do not have access to send invoice emails.";
		case "BOOKING_NOT_FOUND":
			return "That booking no longer exists.";
		case "INVALID_BOOKING_DATA":
			return "This booking has invalid invoice data.";
		case "INVOICE_SEND_FAILED":
			return "Invoice email failed to send. Check the Convex logs.";
		default:
			return "Unable to send invoice email.";
	}
}
