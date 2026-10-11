import { err, ok, okAsync, type Result } from "neverthrow";
import { internal } from "#convex/_generated/api";
import type { Id } from "#convex/_generated/dataModel";
import type { ActionCtx } from "#convex/_generated/server";
import type { DriveSetupInfo } from "#convex/drive/lib/sessionFolders/driveSetupInfo";
import type { DriveError, SavedDrivePermission } from "#convex/drive/lib/googleDrive";
import { fromConvexTuple } from "#convex/shared/lib/result";
import { isClientFolderSharingDismissed } from "#convex/drive/lib/driveClientAccess";

export function requireMissingClientShareTarget(error: DriveClientPermissionsError) {
	return error.reason === "GOOGLE_DRIVE_SHARE_TARGET_MISSING" ? ok(null) : err(error);
}

export function clientDriveSharingTargets(setup: ReadyBookingDriveFolders) {
	const dismissed = isClientFolderSharingDismissed(setup.driveClient.clientFolderPermission);

	return { dismissed: dismissed ? [setup] : [], active: dismissed ? [] : [setup] };
}

export function writeClientDriveFailureStatus(
	ctx: ActionCtx,
	setup: ReadyBookingDriveFolders,
	error: DriveClientPermissionsError
) {
	if (error.reason === "GOOGLE_DRIVE_SHARE_TARGET_MISSING") return okAsync(null);

	return writeClientDrivePermissionsStatus(ctx, { bookingId: setup.booking._id, status: "failed" });
}

export function recoverNonSendableClientAssetsEmail(
	attempt: "automatic" | "retry",
	error: DriveClientPermissionsError
) {
	return error.reason === "CLIENT_ASSETS_EMAIL_NOT_SENDABLE" && attempt === "automatic"
		? ok(null)
		: err(error);
}

export type DriveClientPermissionsError =
	| DriveError
	| {
			reason:
				| "NOT_AUTHENTICATED"
				| "NOT_AUTHORIZED"
				| "BOOKING_NOT_FOUND"
				| "BOOKING_NOT_ELIGIBLE"
				| "BOOKING_TIMING_CHANGED";
	  }
	| { reason: "DRIVE_FOLDERS_NOT_READY" | "DRIVE_RECORD_NOT_FOUND" }
	| { reason: "CLIENT_ASSETS_EMAIL_NOT_SENDABLE" }
	| { reason: "EMAIL_RENDER_FAILED" | "EMAIL_REQUEST_FAILED" | "EMAIL_RESPONSE_FAILED" };

export type ClientDrivePermissionRequirement = {
	fileId: string;
	name: "Client folder";
	role: "reader";
};

export type ReadyBookingDriveFolders = DriveSetupInfo & {
	driveClient: {
		_id: Id<"driveClients">;
		displayName: string;
		normalizedEmail: string;
		folderId: string;
		assetsFolder: { id: string; url: string };
		clientFolderPermission?: SavedDrivePermission;
		assetsClientPermission?: SavedDrivePermission;
	};
	driveSession: {
		_id: Id<"driveSessions">;
		sessionFolder: { id: string; url: string };
		rawMediaFolder: { id: string; url: string };
		deliverablesFolder: { id: string; url: string };
	};
};

export type ClientAssetsEmailClaim = {
	assetsFolderId: string;
	assetsUrl: string;
	bookingId: Id<"bookings">;
	claimedAt: number;
	email: string;
	name: string;
};

export function readyBookingDriveFolders(
	setupInfo: DriveSetupInfo
): ReadyBookingDriveFolders | null {
	const { driveClient, driveSession } = setupInfo;

	if (driveClient === null || driveSession === null) return null;

	const {
		assetsFolder,
		folderId,
		assetsClientPermission,
		clientFolderPermission,
		displayName,
		normalizedEmail
	} = driveClient;

	const { _id: sessionId, deliverablesFolder, rawMediaFolder, sessionFolder } = driveSession;

	if (
		folderId === undefined ||
		assetsFolder === undefined ||
		sessionFolder === undefined ||
		rawMediaFolder === undefined ||
		deliverablesFolder === undefined
	) {
		return null;
	}

	return {
		...setupInfo,
		driveClient: {
			_id: driveClient._id,
			assetsFolder,
			assetsClientPermission,
			clientFolderPermission,
			displayName,
			folderId,
			normalizedEmail
		},
		driveSession: { _id: sessionId, deliverablesFolder, rawMediaFolder, sessionFolder }
	};
}

export function requireReadyBookingDriveFolders(
	setupInfo: DriveSetupInfo
): Result<ReadyBookingDriveFolders, DriveClientPermissionsError> {
	const ready = readyBookingDriveFolders(setupInfo);

	return ready === null ? err({ reason: "DRIVE_FOLDERS_NOT_READY" as const }) : ok(ready);
}

export function loadDriveSetup(ctx: ActionCtx, bookingId: Id<"bookings">) {
	return fromConvexTuple(ctx.runQuery(internal.sessions.drive.getDriveSetup, { bookingId }));
}

export function writeClientDrivePermission(
	ctx: ActionCtx,
	args: {
		bookingId: Id<"bookings">;
		name: "Assets" | "Client folder";
		permission: SavedDrivePermission;
	}
) {
	return fromConvexTuple(ctx.runMutation(internal.sessions.drive.saveClientDrivePermission, args));
}

export function writeClientDrivePermissionsStatus(
	ctx: ActionCtx,
	args: { bookingId: Id<"bookings">; status: "failed" | "ready" | "skipped" }
) {
	return fromConvexTuple(
		ctx.runMutation(internal.sessions.drive.saveClientDrivePermissionsStatus, args)
	);
}

export function writeClientAssetsEmailResult(
	ctx: ActionCtx,
	args: {
		assetsFolderId: string;
		bookingId: Id<"bookings">;
		claimedAt: number;
		status: "sent" | "failed";
	}
) {
	return fromConvexTuple(
		ctx.runMutation(internal.sessions.drive.saveClientAssetsEmailResult, args)
	);
}

export function claimClientAssetsEmailAttempt(
	ctx: ActionCtx,
	args: { bookingId: Id<"bookings">; attempt: "automatic" | "retry"; now: number }
) {
	return fromConvexTuple(ctx.runMutation(internal.sessions.drive.claimClientAssetsEmail, args));
}
