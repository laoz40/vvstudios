export function getBookingDeliverablesEmailErrorMessage(error: unknown) {
	if (typeof error !== "object" || error === null) {
		return "Unable to send deliverables email.";
	}

	const code = "data" in error ? (error as { data?: { code?: string } }).data?.code : undefined;

	switch (code) {
		case "NOT_AUTHENTICATED":
			return "You are not signed in.";
		case "BOOKING_NOT_FOUND":
			return "That booking no longer exists.";
		case "INVALID_DRIVE_LINK":
			return "Enter a valid Google Drive link.";
		default:
			return "Unable to send deliverables email.";
	}
}
