"use node";

import { err, errAsync, ok, okAsync, type ResultAsync } from "neverthrow";
import { internal } from "#convex/_generated/api";
import type { Id } from "#convex/_generated/dataModel";
import type { ActionCtx } from "#convex/_generated/server";
import { type DriveSetupInfo, validateDriveSetup } from "#convex/lib/driveSetup";
import {
	createDrivePermission,
	ensureAnyonePermission,
	findDrivePermission,
	loadDriveClient,
	type DriveClient,
	type DriveError,
	type SavedDrivePermission
} from "#convex/lib/googleDrive";
import {
	dismissedClientFolderPermission,
	isClientFolderSharingDismissed
} from "#convex/lib/driveClientAccess";
import { sendClientAssetsEmail } from "#convex/lib/emailTemplateSenders";
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

export function loadReadyBookingDriveFolders(
	ctx: ActionCtx,
	bookingId: Id<"bookings">
): ResultAsync<ReadyBookingDriveFolders, DriveClientPermissionsError> {
	return fromConvexTuple(ctx.runQuery(internal.sessions.getDriveSetup, { bookingId }))
		.andThen((setupInfo) => validateDriveSetup(setupInfo))
		.andThen((setupInfo) => {
			const readyFolders = getReadyBookingFolders(setupInfo);

			if (readyFolders === null) {
				return err({ reason: "DRIVE_FOLDERS_NOT_READY" as const });
			}

			return ok({ ...setupInfo, ...readyFolders });
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
	}).andThen((existingPermission) => {
		if (existingPermission !== null) return ok(existingPermission);

		return createDrivePermission(drive, {
			email: clientEmail,
			fileId: requirement.fileId,
			role: requirement.role,
			sendNotificationEmail: false
		});
	});
}

function saveClientDrivePermission(
	ctx: ActionCtx,
	bookingId: Id<"bookings">,
	name: "Assets" | "Client folder",
	permission: SavedDrivePermission
) {
	return fromConvexTuple(
		ctx.runMutation(internal.sessions.saveClientDrivePermission, { bookingId, name, permission })
	);
}

export function saveClientDrivePermissionsStatus(
	ctx: ActionCtx,
	bookingId: Id<"bookings">,
	status: "failed" | "ready" | "skipped"
) {
	return fromConvexTuple(
		ctx.runMutation(internal.sessions.saveClientDrivePermissionsStatus, { bookingId, status })
	);
}

function applySkippedClientDrivePermissions(
	ctx: ActionCtx,
	setup: ReadyBookingDriveFolders,
	drive: DriveClient
): ResultAsync<ReadyBookingDriveFolders, DriveClientPermissionsError> {
	return ensureAnyonePermission(drive, setup.driveClient.assetsFolder.id, "writer")
		.andThen((permission) =>
			saveClientDrivePermission(ctx, setup.booking._id, "Assets", {
				id: permission.id,
				role: permission.role
			})
		)
		.andThen(() =>
			saveClientDrivePermission(
				ctx,
				setup.booking._id,
				"Client folder",
				dismissedClientFolderPermission
			)
		)
		.andThen(() => saveClientDrivePermissionsStatus(ctx, setup.booking._id, "skipped"))
		.map(() => setup);
}

export function recordClientDrivePermissionsFailure(
	ctx: ActionCtx,
	setup: ReadyBookingDriveFolders,
	error: DriveClientPermissionsError
): ResultAsync<ReadyBookingDriveFolders, DriveClientPermissionsError> {
	if (error.reason === "GOOGLE_DRIVE_SHARE_TARGET_MISSING") {
		return loadDriveClient().andThen((drive) =>
			applySkippedClientDrivePermissions(ctx, setup, drive)
		);
	}

	return saveClientDrivePermissionsStatus(ctx, setup.booking._id, "failed").andThen(() =>
		errAsync(error)
	);
}

export function requireClientDrivePermissions(
	ctx: ActionCtx,
	setup: ReadyBookingDriveFolders
): ResultAsync<ReadyBookingDriveFolders, DriveClientPermissionsError> {
	return loadDriveClient().andThen((drive) => {
		if (isClientFolderSharingDismissed(setup.driveClient.clientFolderPermission)) {
			return applySkippedClientDrivePermissions(ctx, setup, drive);
		}

		return ensureAnyonePermission(drive, setup.driveClient.assetsFolder.id, "writer")
			.andThen((permission) =>
				saveClientDrivePermission(ctx, setup.booking._id, "Assets", {
					id: permission.id,
					role: permission.role
				})
			)
			.andThen(() =>
				requireClientDrivePermission(drive, setup, {
					fileId: setup.driveClient.folderId,
					name: "Client folder",
					role: "reader"
				})
			)
			.andThen((permission) =>
				saveClientDrivePermission(ctx, setup.booking._id, "Client folder", permission)
			)
			.andThen(() => saveClientDrivePermissionsStatus(ctx, setup.booking._id, "ready"))
			.map(() => setup)
			.orElse((error) => {
				if (error.reason !== "GOOGLE_DRIVE_SHARE_TARGET_MISSING") {
					return errAsync(error);
				}

				return applySkippedClientDrivePermissions(ctx, setup, drive);
			});
	});
}

export function sendClientAssetsFolderEmail(
	ctx: ActionCtx,
	bookingId: Id<"bookings">,
	attempt: "automatic" | "retry"
): ResultAsync<null, DriveClientPermissionsError> {
	return (
		fromConvexTuple(
			ctx.runMutation(internal.sessions.claimClientAssetsEmail, {
				bookingId,
				attempt,
				now: Date.now()
			})
		)
			.andThen((claim) =>
				sendClientAssetsEmail({
					assetsUrl: claim.assetsUrl,
					bookingId: claim.bookingId,
					email: claim.email,
					name: claim.name
				})
					.andThen(() =>
						fromConvexTuple(
							ctx.runMutation(internal.sessions.saveClientAssetsEmailResult, {
								assetsFolderId: claim.assetsFolderId,
								bookingId: claim.bookingId,
								claimedAt: claim.claimedAt,
								status: "sent"
							})
						)
					)
					.orElse((emailError) =>
						fromConvexTuple(
							ctx.runMutation(internal.sessions.saveClientAssetsEmailResult, {
								assetsFolderId: claim.assetsFolderId,
								bookingId: claim.bookingId,
								claimedAt: claim.claimedAt,
								status: "failed"
							})
						).andThen(() => errAsync(emailError))
					)
			)
			.orElse((error) => {
				if (error.reason !== "CLIENT_ASSETS_EMAIL_NOT_SENDABLE") {
					return errAsync(error);
				}

				// Automatic sends may already be done; admin retry should surface a real failure.
				return attempt === "automatic" ? okAsync(null) : errAsync(error);
			})
	);
}
