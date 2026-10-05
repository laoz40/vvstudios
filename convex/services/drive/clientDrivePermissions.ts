"use node";

import { err, errAsync, ok, okAsync, type ResultAsync } from "neverthrow";
import { internal } from "#convex/_generated/api";
import type { Id } from "#convex/_generated/dataModel";
import type { ActionCtx } from "#convex/_generated/server";
import {
	type DriveSetupInfo,
	validateDriveSetup
} from "#convex/lib/drive/sessionFolders/driveSetupInfo";
import {
	createDrivePermission,
	ensureAnyonePermission,
	findDrivePermission,
	loadDriveClient,
	type DriveClient,
	type DriveError,
	type SavedDrivePermission
} from "#convex/lib/drive/googleDrive";
import {
	dismissedClientFolderPermission,
	isClientFolderSharingDismissed
} from "#convex/lib/drive/driveClientAccess";
import { sendClientAssetsEmail } from "#convex/services/email/templateEmails";
import { fromConvexTuple } from "#convex/lib/result";

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

type ReadyBookingDriveFolders = DriveSetupInfo & {
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

type ClientDrivePermissionRequirement = { fileId: string; name: "Client folder"; role: "reader" };

function returnSetup(setup: ReadyBookingDriveFolders) {
	return setup;
}

function getReadyBookingFolders(setupInfo: DriveSetupInfo) {
	const { driveClient, driveSession } = setupInfo;

	if (driveClient === null || driveSession === null) return null;
	const assetsFolder = driveClient.assetsFolder;
	const clientFolderId = driveClient.folderId;
	const sessionFolder = driveSession.sessionFolder;
	const rawMediaFolder = driveSession.rawMediaFolder;
	const deliverablesFolder = driveSession.deliverablesFolder;

	if (
		clientFolderId === undefined ||
		assetsFolder === undefined ||
		sessionFolder === undefined ||
		rawMediaFolder === undefined ||
		deliverablesFolder === undefined
	) {
		return null;
	}

	return {
		driveClient: {
			_id: driveClient._id,
			assetsFolder,
			assetsClientPermission: driveClient.assetsClientPermission,
			clientFolderPermission: driveClient.clientFolderPermission,
			displayName: driveClient.displayName,
			folderId: clientFolderId,
			normalizedEmail: driveClient.normalizedEmail
		},
		driveSession: { _id: driveSession._id, deliverablesFolder, rawMediaFolder, sessionFolder }
	};
}

function requireReadyBookingDriveFolders(setupInfo: DriveSetupInfo) {
	const readyFolders = getReadyBookingFolders(setupInfo);

	if (readyFolders === null) {
		return err({ reason: "DRIVE_FOLDERS_NOT_READY" as const });
	}

	return ok({ ...setupInfo, ...readyFolders });
}

function validateLoadedDriveSetupInfo(setupInfo: DriveSetupInfo | null) {
	return validateDriveSetup(setupInfo);
}

function loadReadyFoldersAfterValidation(setupInfo: DriveSetupInfo) {
	return requireReadyBookingDriveFolders(setupInfo);
}

export function loadReadyBookingDriveFolders(
	ctx: ActionCtx,
	bookingId: Id<"bookings">
): ResultAsync<ReadyBookingDriveFolders, DriveClientPermissionsError> {
	return fromConvexTuple(ctx.runQuery(internal.sessionsDriveInternal.getDriveSetup, { bookingId }))
		.andThen(validateLoadedDriveSetupInfo)
		.andThen(loadReadyFoldersAfterValidation);
}

function createClientDrivePermissionWhenMissing(
	drive: DriveClient,
	setup: ReadyBookingDriveFolders,
	requirement: ClientDrivePermissionRequirement,

	existingPermission: SavedDrivePermission | null
) {
	if (existingPermission !== null) return ok(existingPermission);

	const clientEmail = setup.driveClient.normalizedEmail;

	return createDrivePermission(drive, {
		email: clientEmail,
		fileId: requirement.fileId,
		role: requirement.role,
		sendNotificationEmail: false
	});
}

function requireClientDrivePermission(
	drive: DriveClient,
	setup: ReadyBookingDriveFolders,
	requirement: ClientDrivePermissionRequirement
): ResultAsync<SavedDrivePermission, DriveClientPermissionsError> {
	const clientEmail = setup.driveClient.normalizedEmail;

	return findDrivePermission(drive, {
		email: clientEmail,
		fileId: requirement.fileId,
		role: requirement.role
	}).andThen((existingPermission: SavedDrivePermission | null) =>
		createClientDrivePermissionWhenMissing(drive, setup, requirement, existingPermission)
	);
}

function saveClientDrivePermission(
	ctx: ActionCtx,
	bookingId: Id<"bookings">,
	name: "Assets" | "Client folder",
	permission: SavedDrivePermission
) {
	return fromConvexTuple(
		ctx.runMutation(internal.sessionsDriveInternal.saveClientDrivePermission, {
			bookingId,
			name,
			permission
		})
	);
}

export function saveClientDrivePermissionsStatus(
	ctx: ActionCtx,
	bookingId: Id<"bookings">,
	status: "failed" | "ready" | "skipped"
) {
	return fromConvexTuple(
		ctx.runMutation(internal.sessionsDriveInternal.saveClientDrivePermissionsStatus, {
			bookingId,
			status
		})
	);
}

function saveAssetsPermissionFromAnyoneGrant(
	ctx: ActionCtx,
	setup: ReadyBookingDriveFolders,
	permission: SavedDrivePermission
) {
	return saveClientDrivePermission(ctx, setup.booking._id, "Assets", {
		id: permission.id,
		role: permission.role
	});
}

function saveDismissedClientFolderPermission(ctx: ActionCtx, setup: ReadyBookingDriveFolders) {
	return saveClientDrivePermission(
		ctx,
		setup.booking._id,
		"Client folder",
		dismissedClientFolderPermission
	);
}

function markClientDrivePermissionsSkipped(ctx: ActionCtx, setup: ReadyBookingDriveFolders) {
	return saveClientDrivePermissionsStatus(ctx, setup.booking._id, "skipped");
}

function applySkippedClientDrivePermissions(
	ctx: ActionCtx,
	setup: ReadyBookingDriveFolders,
	drive: DriveClient
): ResultAsync<ReadyBookingDriveFolders, DriveClientPermissionsError> {
	return ensureAnyonePermission(drive, setup.driveClient.assetsFolder.id, "writer")
		.andThen((permission: SavedDrivePermission) =>
			saveAssetsPermissionFromAnyoneGrant(ctx, setup, permission)
		)
		.andThen(() => saveDismissedClientFolderPermissionStep(ctx, setup))
		.andThen(() => markClientDrivePermissionsSkippedStep(ctx, setup))
		.map(() => returnSetup(setup));
}

function saveDismissedClientFolderPermissionStep(ctx: ActionCtx, setup: ReadyBookingDriveFolders) {
	return saveDismissedClientFolderPermission(ctx, setup);
}

function markClientDrivePermissionsSkippedStep(ctx: ActionCtx, setup: ReadyBookingDriveFolders) {
	return markClientDrivePermissionsSkipped(ctx, setup);
}

function applySkippedPermissionsForSetup(
	ctx: ActionCtx,
	setup: ReadyBookingDriveFolders,
	drive: DriveClient
) {
	return applySkippedClientDrivePermissions(ctx, setup, drive);
}

function rethrowClientPermissionsError(error: DriveClientPermissionsError) {
	return errAsync(error);
}

export function recordClientDrivePermissionsFailure(
	ctx: ActionCtx,
	setup: ReadyBookingDriveFolders,
	error: DriveClientPermissionsError
): ResultAsync<ReadyBookingDriveFolders, DriveClientPermissionsError> {
	if (error.reason === "GOOGLE_DRIVE_SHARE_TARGET_MISSING") {
		return loadDriveClient().andThen((drive: DriveClient) =>
			applySkippedPermissionsForSetup(ctx, setup, drive)
		);
	}

	return saveClientDrivePermissionsStatus(ctx, setup.booking._id, "failed").andThen(() =>
		rethrowClientPermissionsError(error)
	);
}

function saveAssetsWriterPermission(
	ctx: ActionCtx,
	setup: ReadyBookingDriveFolders,
	permission: SavedDrivePermission
) {
	return saveClientDrivePermission(ctx, setup.booking._id, "Assets", {
		id: permission.id,
		role: permission.role
	});
}

function requireClientFolderReaderPermission(drive: DriveClient, setup: ReadyBookingDriveFolders) {
	return requireClientDrivePermission(drive, setup, {
		fileId: setup.driveClient.folderId,
		name: "Client folder",
		role: "reader"
	});
}

function saveClientFolderReaderPermission(
	ctx: ActionCtx,
	setup: ReadyBookingDriveFolders,
	permission: SavedDrivePermission
) {
	return saveClientDrivePermission(ctx, setup.booking._id, "Client folder", permission);
}

function markClientDrivePermissionsReady(ctx: ActionCtx, setup: ReadyBookingDriveFolders) {
	return saveClientDrivePermissionsStatus(ctx, setup.booking._id, "ready");
}

function markReadyAndReturnSetup(ctx: ActionCtx, setup: ReadyBookingDriveFolders) {
	return markClientDrivePermissionsReady(ctx, setup).map(() => returnSetup(setup));
}

function applyShareTargetMissingFallback(
	ctx: ActionCtx,
	setup: ReadyBookingDriveFolders,
	drive: DriveClient,

	error: DriveClientPermissionsError
) {
	if (error.reason !== "GOOGLE_DRIVE_SHARE_TARGET_MISSING") {
		return errAsync(error);
	}

	return applySkippedClientDrivePermissions(ctx, setup, drive);
}

function applyActiveClientDrivePermissions(
	ctx: ActionCtx,
	setup: ReadyBookingDriveFolders,
	drive: DriveClient
): ResultAsync<ReadyBookingDriveFolders, DriveClientPermissionsError> {
	return ensureAnyonePermission(drive, setup.driveClient.assetsFolder.id, "writer")
		.andThen((permission: SavedDrivePermission) =>
			saveAssetsWriterPermission(ctx, setup, permission)
		)
		.andThen(() => requireClientFolderReaderPermissionStep(drive, setup))
		.andThen((permission: SavedDrivePermission) =>
			saveClientFolderReaderPermission(ctx, setup, permission)
		)
		.andThen(() => markReadyAndReturnSetup(ctx, setup))
		.orElse((error: DriveClientPermissionsError) =>
			applyShareTargetMissingFallback(ctx, setup, drive, error)
		);
}

function requireClientFolderReaderPermissionStep(
	drive: DriveClient,
	setup: ReadyBookingDriveFolders
) {
	return requireClientFolderReaderPermission(drive, setup);
}

function applyClientDrivePermissionsForDrive(
	ctx: ActionCtx,
	setup: ReadyBookingDriveFolders,
	drive: DriveClient
) {
	if (isClientFolderSharingDismissed(setup.driveClient.clientFolderPermission)) {
		return applySkippedClientDrivePermissions(ctx, setup, drive);
	}

	return applyActiveClientDrivePermissions(ctx, setup, drive);
}

export function requireClientDrivePermissions(
	ctx: ActionCtx,
	setup: ReadyBookingDriveFolders
): ResultAsync<ReadyBookingDriveFolders, DriveClientPermissionsError> {
	return loadDriveClient().andThen((drive: DriveClient) =>
		applyClientDrivePermissionsForDrive(ctx, setup, drive)
	);
}

function saveSentClientAssetsEmailResult(ctx: ActionCtx, claim: ClientAssetsEmailClaim) {
	return fromConvexTuple(
		ctx.runMutation(internal.sessionsDriveInternal.saveClientAssetsEmailResult, {
			assetsFolderId: claim.assetsFolderId,
			bookingId: claim.bookingId,
			claimedAt: claim.claimedAt,
			status: "sent"
		})
	);
}

function saveFailedClientAssetsEmailResult(ctx: ActionCtx, claim: ClientAssetsEmailClaim) {
	return fromConvexTuple(
		ctx.runMutation(internal.sessionsDriveInternal.saveClientAssetsEmailResult, {
			assetsFolderId: claim.assetsFolderId,
			bookingId: claim.bookingId,
			claimedAt: claim.claimedAt,
			status: "failed"
		})
	);
}

function rethrowEmailError(emailError: DriveClientPermissionsError) {
	return errAsync(emailError);
}

type ClientAssetsEmailClaim = {
	assetsFolderId: string;
	assetsUrl: string;
	bookingId: Id<"bookings">;
	claimedAt: number;
	email: string;
	name: string;
};

function sendClaimedClientAssetsEmail(ctx: ActionCtx, claim: ClientAssetsEmailClaim) {
	return sendClientAssetsEmail({
		assetsUrl: claim.assetsUrl,
		bookingId: claim.bookingId,
		email: claim.email,
		name: claim.name
	})
		.andThen(() => saveSentClientAssetsEmailAfterSend(ctx, claim))
		.orElse((emailError: DriveClientPermissionsError) =>
			recordFailedClientAssetsEmail(ctx, claim, emailError)
		);
}

function saveSentClientAssetsEmailAfterSend(ctx: ActionCtx, claim: ClientAssetsEmailClaim) {
	return saveSentClientAssetsEmailResult(ctx, claim);
}

function recordFailedClientAssetsEmail(
	ctx: ActionCtx,
	claim: ClientAssetsEmailClaim,
	emailError: DriveClientPermissionsError
) {
	return saveFailedClientAssetsEmailResult(ctx, claim).andThen(() => rethrowEmailError(emailError));
}

function handleClientAssetsEmailClaim(ctx: ActionCtx, claim: ClientAssetsEmailClaim) {
	return sendClaimedClientAssetsEmail(ctx, claim);
}

function ignoreNonSendableClientAssetsEmail(
	attempt: "automatic" | "retry",
	error: DriveClientPermissionsError
) {
	if (error.reason !== "CLIENT_ASSETS_EMAIL_NOT_SENDABLE") {
		return errAsync(error);
	}

	// Automatic sends may already be done; admin retry should surface a real failure.
	return attempt === "automatic" ? okAsync(null) : errAsync(error);
}

export function sendClientAssetsFolderEmail(
	ctx: ActionCtx,
	bookingId: Id<"bookings">,
	attempt: "automatic" | "retry"
): ResultAsync<null, DriveClientPermissionsError> {
	return fromConvexTuple(
		ctx.runMutation(internal.sessionsDriveInternal.claimClientAssetsEmail, {
			bookingId,
			attempt,
			now: Date.now()
		})
	)
		.andThen((claim: ClientAssetsEmailClaim) => handleClientAssetsEmailClaim(ctx, claim))
		.orElse((error: DriveClientPermissionsError) =>
			ignoreNonSendableClientAssetsEmail(attempt, error)
		);
}
