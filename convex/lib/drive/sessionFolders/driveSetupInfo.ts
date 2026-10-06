import { err, ok } from "neverthrow";
import type { Doc, Id } from "#convex/_generated/dataModel";
import type { DriveError, SavedDrivePermission } from "#convex/lib/drive/googleDrive";

type SavedFolder = { id: string; url: string };

type SetupPackage = {
	_id: Id<"packages">;
	packageSize: Doc<"packages">["packageSize"];
	paidAt?: number;
	createdAt: number;
};

export type DriveSetupInfo = {
	booking: {
		_id: Id<"bookings">;
		name: string;
		accountName: string;
		email: string;
		sessionStartAt: number;
		duration: string;
		status: Doc<"bookings">["status"];
		packageId?: Id<"packages">;
		assignedEditorTokenIdentifier?: string;
	};
	packageRecord: SetupPackage | null;
	driveClient: {
		_id: Id<"driveClients">;
		normalizedEmail: string;
		displayName: string;
		folderId?: string;
		assetsFolder?: SavedFolder;
		clientFolderPermission?: SavedDrivePermission;
		assetsClientPermission?: SavedDrivePermission;
	} | null;
	driveSession: {
		_id: Id<"driveSessions">;
		packageSessionNumber?: number;
		clientSessionNumber?: number;
		packageFolder?: SavedFolder;
		sessionFolder?: SavedFolder;
		rawMediaFolder?: SavedFolder;
		deliverablesFolder?: SavedFolder;
	} | null;
	sharedPackageFolder?: SavedFolder;
};

export type SetupError =
	| DriveError
	| {
			reason:
				| "NOT_AUTHENTICATED"
				| "NOT_AUTHORIZED"
				| "DRIVE_RECORD_NOT_FOUND"
				| "BOOKING_NOT_FOUND"
				| "BOOKING_NOT_PACKAGE"
				| "BOOKING_IS_PACKAGE"
				| "BOOKING_NOT_ELIGIBLE"
				| "BOOKING_TIMING_CHANGED"
				| "DRIVE_FOLDERS_ALREADY_CREATED"
				| "DRIVE_FOLDERS_INCOMPLETE"
				| "GOOGLE_DRIVE_SAVE_FAILED";
	  };

export function areDriveSetupFoldersSaved(setupInfo: DriveSetupInfo | null) {
	if (setupInfo === null) return false;
	const { driveClient, driveSession, packageRecord, sharedPackageFolder } = setupInfo;

	if (driveClient?.folderId === undefined || driveClient.assetsFolder === undefined) return false;

	if (driveSession === null || driveSession.sessionFolder === undefined) return false;

	if (driveSession.rawMediaFolder === undefined || driveSession.deliverablesFolder === undefined) {
		return false;
	}

	if (
		packageRecord !== null &&
		driveSession.packageFolder === undefined &&
		sharedPackageFolder === undefined
	) {
		return false;
	}

	return true;
}

const recordDriveSetupFailureByReason = {
	GOOGLE_DRIVE_AUTH_FAILED: true,
	GOOGLE_DRIVE_FOLDER_CREATE_FAILED: true,
	GOOGLE_DRIVE_FOLDER_RESPONSE_INVALID: true,
	GOOGLE_DRIVE_FOLDER_LOOKUP_FAILED: true,
	GOOGLE_DRIVE_FOLDER_MISSING: true,
	GOOGLE_DRIVE_FOLDER_DELETE_FAILED: false,
	GOOGLE_DRIVE_FOLDER_RENAME_FAILED: true,
	GOOGLE_DRIVE_PERMISSION_CREATE_FAILED: false,
	GOOGLE_DRIVE_PERMISSION_DELETE_FAILED: false,
	GOOGLE_DRIVE_PERMISSION_LOOKUP_FAILED: false,
	GOOGLE_DRIVE_PERMISSION_RESPONSE_INVALID: false,
	GOOGLE_DRIVE_SHARE_TARGET_MISSING: false,
	GOOGLE_DRIVE_SAVE_FAILED: true,
	DRIVE_RECORD_NOT_FOUND: true,
	NOT_AUTHENTICATED: false,
	NOT_AUTHORIZED: false,
	BOOKING_NOT_FOUND: false,
	BOOKING_NOT_PACKAGE: true,
	BOOKING_IS_PACKAGE: true,
	BOOKING_NOT_ELIGIBLE: false,
	BOOKING_TIMING_CHANGED: false,
	DRIVE_FOLDERS_ALREADY_CREATED: false,
	DRIVE_FOLDERS_INCOMPLETE: true
} satisfies Record<SetupError["reason"], boolean>;

export function shouldRecordDriveSetupFailure(error: SetupError) {
	return recordDriveSetupFailureByReason[error.reason];
}

export function validateDriveSetup(
	setupInfo: DriveSetupInfo | null,
	expectedTiming?: { sessionStartAt: number; duration: string }
) {
	if (setupInfo === null) return err({ reason: "BOOKING_NOT_FOUND" as const });

	if (setupInfo.booking.status !== "confirmed" && setupInfo.booking.status !== "email_failed") {
		return err({ reason: "BOOKING_NOT_ELIGIBLE" as const });
	}

	if (
		expectedTiming !== undefined &&
		(setupInfo.booking.sessionStartAt !== expectedTiming.sessionStartAt ||
			setupInfo.booking.duration !== expectedTiming.duration)
	) {
		return err({ reason: "BOOKING_TIMING_CHANGED" as const });
	}

	return ok(setupInfo);
}
