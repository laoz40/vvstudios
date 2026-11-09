export function deliverablesEmailErrorToast(reason: string) {
	const driveError = getDeliverablesDriveErrorToast(reason);

	if (driveError !== undefined) return driveError;

	switch (reason) {
		case "NOT_AUTHENTICATED":
			return "You are not signed in.";
		case "NOT_AUTHORIZED":
			return "You do not have access to send deliverables emails.";
		case "BOOKING_NOT_FOUND":
			return "That session no longer exists.";
		case "SESSION_NOT_ASSIGNED_TO_EDITOR":
		case "SESSION_NOT_CONFIRMED":
		case "SESSION_NOT_IN_PAST":
			return "This session is not eligible for a deliverables email.";
		case "DELIVERABLES_FOLDER_EMPTY":
			return "Deliverables is empty. Add the finished files before sending.";
		case "EMAIL_RENDER_FAILED":
		case "EMAIL_REQUEST_FAILED":
		case "EMAIL_RESPONSE_FAILED":
			return "Unable to send deliverables email.";
		default:
			return "Something went wrong while sending the deliverables email.";
	}
}

function getDeliverablesDriveErrorToast(reason: string): string | undefined {
	switch (reason) {
		case "GOOGLE_DRIVE_AUTH_FAILED":
			return "Couldn't access Google Drive. Try again.";
		case "GOOGLE_DRIVE_FOLDER_MISSING":
			return "This session has no Deliverables folder yet.";
		case "GOOGLE_DRIVE_FOLDER_CREATE_FAILED":
		case "GOOGLE_DRIVE_FOLDER_RESPONSE_INVALID":
		case "GOOGLE_DRIVE_FOLDER_LOOKUP_FAILED":
		case "GOOGLE_DRIVE_FOLDER_RENAME_FAILED":
		case "GOOGLE_DRIVE_FOLDER_DELETE_FAILED":
			return "Couldn't access the Deliverables folder. Try again.";
		case "GOOGLE_DRIVE_PERMISSION_CREATE_FAILED":
		case "GOOGLE_DRIVE_PERMISSION_DELETE_FAILED":
		case "GOOGLE_DRIVE_PERMISSION_LOOKUP_FAILED":
		case "GOOGLE_DRIVE_PERMISSION_RESPONSE_INVALID":
		case "GOOGLE_DRIVE_SHARE_TARGET_MISSING":
			return "Couldn't create a viewable Deliverables link. Try again.";
		default:
			return undefined;
	}
}
