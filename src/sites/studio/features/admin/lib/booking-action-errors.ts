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
		default:
			return "Unable to delete booking.";
	}
}

export function getBookingMutationErrorMessage(error: unknown) {
	switch (getConvexErrorCode(error)) {
		case "NOT_AUTHENTICATED":
			return "You are not signed in.";
		case "BOOKING_NOT_FOUND":
			return "That booking no longer exists.";
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
		case "BOOKING_NOT_FOUND":
			return "That booking no longer exists.";
		case "INVALID_BOOKING_DATA":
			return "This booking has invalid invoice data.";
		default:
			return "Unable to send invoice email.";
	}
}
