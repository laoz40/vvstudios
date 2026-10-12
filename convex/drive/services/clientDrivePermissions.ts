"use node";

import { err, ok, ResultAsync, safeTry } from "neverthrow";
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
	return safeTry(async function* () {
		const setup = yield* loadDriveSetup(ctx, bookingId);
		const validatedSetup = yield* validateDriveSetup(setup);

		return ok(yield* requireReadyFolders(validatedSetup));
	});
}

function requireClientDrivePermission(
	drive: DriveClient,
	setup: ReadyBookingDriveFolders,
	requirement: ClientDrivePermissionRequirement
): ResultAsync<SavedDrivePermission, DriveClientPermissionsError> {
	return safeTry(async function* () {
		const existingPermission = yield* findDrivePermission(drive, {
			email: setup.driveClient.normalizedEmail,
			fileId: requirement.fileId,
			role: requirement.role
		});

		const response = yield* createDrivePermissionIfMissingRequest(
			drive,
			{
				email: setup.driveClient.normalizedEmail,
				fileId: requirement.fileId,
				role: requirement.role,
				sendNotificationEmail: false
			},
			existingPermission
		);

		return ok(yield* parseDrivePermissionResponse(response));
	});
}

function applySkippedClientDrivePermissions(
	ctx: ActionCtx,
	setup: ReadyBookingDriveFolders,
	drive: DriveClient
): ResultAsync<ReadyBookingDriveFolders, DriveClientPermissionsError> {
	return safeTry(async function* () {
		const permission = yield* ensureAnyonePermission(
			drive,
			setup.driveClient.assetsFolder.id,
			"writer"
		);

		yield* writeClientDrivePermission(ctx, {
			bookingId: setup.booking._id,
			name: "Assets",
			permission: { id: permission.id, role: permission.role }
		});
		yield* writeClientDrivePermission(ctx, {
			bookingId: setup.booking._id,
			name: "Client folder",
			permission: dismissedClientFolderPermission
		});
		yield* writeClientDrivePermissionsStatus(ctx, {
			bookingId: setup.booking._id,
			status: "skipped"
		});

		return ok(setup);
	});
}

export function recordClientDrivePermissionsFailure(
	ctx: ActionCtx,
	setup: ReadyBookingDriveFolders,
	error: DriveClientPermissionsError
): ResultAsync<ReadyBookingDriveFolders, DriveClientPermissionsError> {
	return safeTry(async function* () {
		yield* writeClientDriveFailureStatus(ctx, setup, error);
		yield* requireMissingClientShareTarget(error);
		const drive = yield* loadDriveClient();

		return ok(yield* applySkippedClientDrivePermissions(ctx, setup, drive));
	});
}

function applyShareTargetMissingFallback(
	ctx: ActionCtx,
	setup: ReadyBookingDriveFolders,
	drive: DriveClient,

	error: DriveClientPermissionsError
) {
	return safeTry(async function* () {
		yield* requireMissingClientShareTarget(error);

		return ok(yield* applySkippedClientDrivePermissions(ctx, setup, drive));
	});
}

function applyActiveClientDrivePermissions(
	ctx: ActionCtx,
	setup: ReadyBookingDriveFolders,
	drive: DriveClient
): ResultAsync<ReadyBookingDriveFolders, DriveClientPermissionsError> {
	const grantPermissions = safeTry(async function* () {
		const assetsPermission = yield* ensureAnyonePermission(
			drive,
			setup.driveClient.assetsFolder.id,
			"writer"
		);

		yield* writeClientDrivePermission(ctx, {
			bookingId: setup.booking._id,
			name: "Assets",
			permission: { id: assetsPermission.id, role: assetsPermission.role }
		});

		const folderPermission = yield* requireClientDrivePermission(drive, setup, {
			fileId: setup.driveClient.folderId,
			name: "Client folder",
			role: "reader"
		});

		yield* writeClientDrivePermission(ctx, {
			bookingId: setup.booking._id,
			name: "Client folder",
			permission: folderPermission
		});
		yield* writeClientDrivePermissionsStatus(ctx, {
			bookingId: setup.booking._id,
			status: "ready"
		});

		return ok(setup);
	});

	return grantPermissions.orElse((error) =>
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
	return safeTry(async function* () {
		const drive = yield* loadDriveClient();

		return ok(yield* applyClientDrivePermissionsForDrive(ctx, setup, drive));
	});
}

function sendClaimedClientAssetsEmail(ctx: ActionCtx, claim: ClientAssetsEmailClaim) {
	const sendAndSave = safeTry(async function* () {
		yield* sendClientAssetsEmail({
			assetsUrl: claim.assetsUrl,
			bookingId: claim.bookingId,
			email: claim.email,
			name: claim.name
		});

		return ok(
			yield* writeClientAssetsEmailResult(ctx, {
				assetsFolderId: claim.assetsFolderId,
				bookingId: claim.bookingId,
				claimedAt: claim.claimedAt,
				status: "sent"
			})
		);
	});

	return sendAndSave.orElse((emailError) => recordFailedClientAssetsEmail(ctx, claim, emailError));
}

function recordFailedClientAssetsEmail(
	ctx: ActionCtx,
	claim: ClientAssetsEmailClaim,
	emailError: DriveClientPermissionsError
) {
	return safeTry(async function* () {
		yield* writeClientAssetsEmailResult(ctx, {
			assetsFolderId: claim.assetsFolderId,
			bookingId: claim.bookingId,
			claimedAt: claim.claimedAt,
			status: "failed"
		});

		return err(emailError);
	});
}

export function sendClientAssetsFolderEmail(
	ctx: ActionCtx,
	bookingId: Id<"bookings">,
	attempt: "automatic" | "retry"
): ResultAsync<null, DriveClientPermissionsError> {
	return safeTry(async function* () {
		const claim = yield* claimClientAssetsEmailAttempt(ctx, {
			bookingId,
			attempt,
			now: Date.now()
		});

		return ok(yield* sendClaimedClientAssetsEmail(ctx, claim));
	}).orElse((error) => recoverNonSendableClientAssetsEmail(attempt, error));
}
