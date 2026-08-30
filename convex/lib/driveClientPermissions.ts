"use node";

import { err, errAsync, ok, okAsync, type ResultAsync } from "neverthrow";
import { internal } from "#convex/_generated/api";
import type { Id } from "#convex/_generated/dataModel";
import type { ActionCtx } from "#convex/_generated/server";
import { type DriveSetupInfo, validateDriveSetup } from "#convex/lib/driveSetup";
import {
	createDrivePermission,
	findDrivePermission,
	loadDriveClient,
	normalizeDriveEmail,
	type DriveClient,
	type DriveError,
	type SavedDrivePermission
} from "#convex/lib/googleDrive";
import { sendClientAssetsEmail } from "#convex/lib/email";
import { fromConvexTuple } from "#convex/lib/result";

export type DriveClientPermissionsError =
	| DriveError
	| {
			reason:
				| "NOT_AUTHENTICATED"
				| "NOT_AUTHORIZED"
				| "BOOKING_NOT_FOUND"
				| "BOOKING_NOT_ELIGIBLE"
				| "BOOKING_TIMING_CHANGED"
				| "PACKAGE_SESSION_NOT_SUPPORTED";
	  }
	| { reason: "DRIVE_FOLDERS_NOT_READY" | "DRIVE_CLIENT_PERMISSIONS_SAVE_FAILED" }
	| { reason: "CLIENT_ASSETS_EMAIL_SEND_FAILED" };

type ReadyBookingDriveFolders = DriveSetupInfo & {
	driveClient: {
		_id: Id<"driveClients">;
		folderId: string;
		assetsFolder: { id: string; url: string };
	};
	driveSession: {
		_id: Id<"driveSessions">;
		sessionFolder: { id: string; url: string };
		rawMediaFolder: { id: string; url: string };
		deliverablesFolder: { id: string; url: string };
	};
};

type ClientDrivePermissionRequirement = {
	fileId: string;
	name: "Assets" | "Client folder";
	role: "reader" | "writer";
};

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
		driveClient: { _id: driveClient._id, assetsFolder, folderId: clientFolderId },
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
	const clientEmail = normalizeDriveEmail(setup.booking.email);
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
	name: ClientDrivePermissionRequirement["name"],
	permission: SavedDrivePermission
) {
	return fromConvexTuple(
		ctx.runMutation(internal.sessions.saveClientDrivePermission, { bookingId, name, permission })
	).mapErr(() => ({ reason: "DRIVE_CLIENT_PERMISSIONS_SAVE_FAILED" as const }));
}

export function saveClientDrivePermissionsStatus(
	ctx: ActionCtx,
	bookingId: Id<"bookings">,
	status: "failed" | "ready"
) {
	return fromConvexTuple(
		ctx.runMutation(internal.sessions.saveClientDrivePermissionsStatus, { bookingId, status })
	).mapErr(() => ({ reason: "DRIVE_CLIENT_PERMISSIONS_SAVE_FAILED" as const }));
}

export function requireClientDrivePermissions(
	ctx: ActionCtx,
	setup: ReadyBookingDriveFolders
): ResultAsync<ReadyBookingDriveFolders, DriveClientPermissionsError> {
	return loadDriveClient()
		.andThen((drive) =>
			requireClientDrivePermission(drive, setup, {
				fileId: setup.driveClient.folderId,
				name: "Client folder",
				role: "reader"
			})
				.andThen((permission) =>
					saveClientDrivePermission(ctx, setup.booking._id, "Client folder", permission)
				)
				.andThen(() =>
					requireClientDrivePermission(drive, setup, {
						fileId: setup.driveClient.assetsFolder.id,
						name: "Assets",
						role: "writer"
					})
				)
				.andThen((permission) =>
					saveClientDrivePermission(ctx, setup.booking._id, "Assets", permission)
				)
		)
		.andThen(() => saveClientDrivePermissionsStatus(ctx, setup.booking._id, "ready"))
		.map(() => setup);
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
				sendClientAssetsEmail({ assetsUrl: claim.assetsUrl, email: claim.email, name: claim.name })
					.mapErr(() => ({ reason: "CLIENT_ASSETS_EMAIL_SEND_FAILED" as const }))
					.andThen(() =>
						fromConvexTuple(
							ctx.runMutation(internal.sessions.saveClientAssetsEmailResult, {
								assetsFolderId: claim.assetsFolderId,
								bookingId: claim.bookingId,
								claimedAt: claim.claimedAt,
								status: "sent"
							})
						).mapErr(() => ({ reason: "DRIVE_CLIENT_PERMISSIONS_SAVE_FAILED" as const }))
					)
					.orElse((emailError) =>
						fromConvexTuple(
							ctx.runMutation(internal.sessions.saveClientAssetsEmailResult, {
								assetsFolderId: claim.assetsFolderId,
								bookingId: claim.bookingId,
								claimedAt: claim.claimedAt,
								status: "failed"
							})
						)
							.mapErr(() => ({ reason: "DRIVE_CLIENT_PERMISSIONS_SAVE_FAILED" as const }))
							.andThen(() => errAsync(emailError))
					)
			)
			// An existing email result means this replay has no message to send.
			.orElse((error) =>
				error.reason === "CLIENT_ASSETS_EMAIL_NOT_SENDABLE" ? okAsync(null) : errAsync(error)
			)
	);
}
