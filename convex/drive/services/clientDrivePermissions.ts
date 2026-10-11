"use node";

import { errAsync, ResultAsync } from "neverthrow";
import type { Id } from "#convex/_generated/dataModel";
import type { ActionCtx } from "#convex/_generated/server";
import { validateDriveSetup } from "#convex/drive/lib/sessionFolders/driveSetupInfo";
import {
	loadDriveClient,
	createDrivePermissionIfMissingRequest,
	parseDrivePermissionResponse,
	type DriveClient,
	type SavedDrivePermission
} from "#convex/drive/lib/googleDrive";
import { findDrivePermission } from "#convex/drive/services/googleDriveOperations";
import { ensureAnyonePermission } from "#convex/drive/services/googleDrivePermissions";
import { dismissedClientFolderPermission } from "#convex/drive/lib/driveClientAccess";
import { sendClientAssetsEmail } from "#convex/email/services/templateEmails";
import {
	loadDriveSetup,
	requireReadyBookingDriveFolders as requireReadyFolders,
	writeClientAssetsEmailResult,
	writeClientDrivePermission,
	writeClientDrivePermissionsStatus,
	claimClientAssetsEmailAttempt,
	requireMissingClientShareTarget,
	clientDriveSharingTargets,
	writeClientDriveFailureStatus,
	recoverNonSendableClientAssetsEmail,
	type ClientDrivePermissionRequirement
} from "#convex/drive/lib/clientDrivePermissions";
import type {
	ClientAssetsEmailClaim as LibClientAssetsEmailClaim,
	DriveClientPermissionsError as LibDriveClientPermissionsError,
	ReadyBookingDriveFolders as LibReadyBookingDriveFolders
} from "#convex/drive/lib/clientDrivePermissions";

export type ClientAssetsEmailClaim = LibClientAssetsEmailClaim;

export type DriveClientPermissionsError = LibDriveClientPermissionsError;

export type ReadyBookingDriveFolders = LibReadyBookingDriveFolders;

export function loadReadyBookingDriveFolders(
	ctx: ActionCtx,
	bookingId: Id<"bookings">
): ResultAsync<ReadyBookingDriveFolders, DriveClientPermissionsError> {
	return loadDriveSetup(ctx, bookingId).andThen(validateDriveSetup).andThen(requireReadyFolders);
}

function requireClientDrivePermission(
	drive: DriveClient,
	setup: ReadyBookingDriveFolders,
	requirement: ClientDrivePermissionRequirement
): ResultAsync<SavedDrivePermission, DriveClientPermissionsError> {
	return findDrivePermission(drive, {
		email: setup.driveClient.normalizedEmail,
		fileId: requirement.fileId,
		role: requirement.role
	})
		.andThen((existingPermission: SavedDrivePermission | null) =>
			createDrivePermissionIfMissingRequest(
				drive,
				{
					email: setup.driveClient.normalizedEmail,
					fileId: requirement.fileId,
					role: requirement.role,
					sendNotificationEmail: false
				},
				existingPermission
			)
		)
		.andThen(parseDrivePermissionResponse);
}

function applySkippedClientDrivePermissions(
	ctx: ActionCtx,
	setup: ReadyBookingDriveFolders,
	drive: DriveClient
): ResultAsync<ReadyBookingDriveFolders, DriveClientPermissionsError> {
	return ensureAnyonePermission(drive, setup.driveClient.assetsFolder.id, "writer")
		.andThen((permission: SavedDrivePermission) =>
			writeClientDrivePermission(ctx, {
				bookingId: setup.booking._id,
				name: "Assets",
				permission: { id: permission.id, role: permission.role }
			})
		)
		.andThen(() =>
			writeClientDrivePermission(ctx, {
				bookingId: setup.booking._id,
				name: "Client folder",
				permission: dismissedClientFolderPermission
			})
		)
		.andThen(() =>
			writeClientDrivePermissionsStatus(ctx, { bookingId: setup.booking._id, status: "skipped" })
		)
		.map(() => setup);
}

export function recordClientDrivePermissionsFailure(
	ctx: ActionCtx,
	setup: ReadyBookingDriveFolders,
	error: DriveClientPermissionsError
): ResultAsync<ReadyBookingDriveFolders, DriveClientPermissionsError> {
	return writeClientDriveFailureStatus(ctx, setup, error)
		.andThen(() => requireMissingClientShareTarget(error))
		.andThen(() => loadDriveClient())
		.andThen((drive) => applySkippedClientDrivePermissions(ctx, setup, drive));
}

function applyShareTargetMissingFallback(
	ctx: ActionCtx,
	setup: ReadyBookingDriveFolders,
	drive: DriveClient,

	error: DriveClientPermissionsError
) {
	return requireMissingClientShareTarget(error).asyncAndThen(() =>
		applySkippedClientDrivePermissions(ctx, setup, drive)
	);
}

function applyActiveClientDrivePermissions(
	ctx: ActionCtx,
	setup: ReadyBookingDriveFolders,
	drive: DriveClient
): ResultAsync<ReadyBookingDriveFolders, DriveClientPermissionsError> {
	return ensureAnyonePermission(drive, setup.driveClient.assetsFolder.id, "writer")
		.andThen((permission: SavedDrivePermission) =>
			writeClientDrivePermission(ctx, {
				bookingId: setup.booking._id,
				name: "Assets",
				permission: { id: permission.id, role: permission.role }
			})
		)
		.andThen(() =>
			requireClientDrivePermission(drive, setup, {
				fileId: setup.driveClient.folderId,
				name: "Client folder",
				role: "reader"
			})
		)
		.andThen((permission: SavedDrivePermission) =>
			writeClientDrivePermission(ctx, {
				bookingId: setup.booking._id,
				name: "Client folder",
				permission
			})
		)
		.andThen(() =>
			writeClientDrivePermissionsStatus(ctx, { bookingId: setup.booking._id, status: "ready" })
		)
		.map(() => setup)
		.orElse((error: DriveClientPermissionsError) =>
			applyShareTargetMissingFallback(ctx, setup, drive, error)
		);
}

function applyClientDrivePermissionsForDrive(
	ctx: ActionCtx,
	setup: ReadyBookingDriveFolders,
	drive: DriveClient
) {
	const targets = clientDriveSharingTargets(setup);

	return ResultAsync.combine([
		...targets.dismissed.map((dismissed) =>
			applySkippedClientDrivePermissions(ctx, dismissed, drive)
		),
		...targets.active.map((active) => applyActiveClientDrivePermissions(ctx, active, drive))
	]).map(() => setup);
}

export function requireClientDrivePermissions(
	ctx: ActionCtx,
	setup: ReadyBookingDriveFolders
): ResultAsync<ReadyBookingDriveFolders, DriveClientPermissionsError> {
	return loadDriveClient().andThen((drive: DriveClient) =>
		applyClientDrivePermissionsForDrive(ctx, setup, drive)
	);
}

function sendClaimedClientAssetsEmail(ctx: ActionCtx, claim: ClientAssetsEmailClaim) {
	return sendClientAssetsEmail({
		assetsUrl: claim.assetsUrl,
		bookingId: claim.bookingId,
		email: claim.email,
		name: claim.name
	})
		.andThen(() =>
			writeClientAssetsEmailResult(ctx, {
				assetsFolderId: claim.assetsFolderId,
				bookingId: claim.bookingId,
				claimedAt: claim.claimedAt,
				status: "sent"
			})
		)
		.orElse((emailError: DriveClientPermissionsError) =>
			recordFailedClientAssetsEmail(ctx, claim, emailError)
		);
}

function recordFailedClientAssetsEmail(
	ctx: ActionCtx,
	claim: ClientAssetsEmailClaim,
	emailError: DriveClientPermissionsError
) {
	return writeClientAssetsEmailResult(ctx, {
		assetsFolderId: claim.assetsFolderId,
		bookingId: claim.bookingId,
		claimedAt: claim.claimedAt,
		status: "failed"
	}).andThen(() => errAsync(emailError));
}

export function sendClientAssetsFolderEmail(
	ctx: ActionCtx,
	bookingId: Id<"bookings">,
	attempt: "automatic" | "retry"
): ResultAsync<null, DriveClientPermissionsError> {
	return claimClientAssetsEmailAttempt(ctx, { bookingId, attempt, now: Date.now() })
		.andThen((claim: ClientAssetsEmailClaim) => sendClaimedClientAssetsEmail(ctx, claim))
		.orElse((error: DriveClientPermissionsError) =>
			recoverNonSendableClientAssetsEmail(attempt, error)
		);
}
