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
	type DriveError
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
	driveClient: { _id: Id<"driveClients">; folderId: string };
	driveSession: {
		_id: Id<"driveSessions">;
		sessionFolder: { id: string; url: string };
		rawMediaFolder: { id: string; url: string };
		assetsFolder: { id: string; url: string };
		deliverablesFolder: { id: string; url: string };
	};
};

type ClientDrivePermissionRequirement = { fileId: string; role: "commenter" | "reader" | "writer" };

export function loadReadyBookingDriveFolders(
	ctx: ActionCtx,
	bookingId: Id<"bookings">
): ResultAsync<ReadyBookingDriveFolders, DriveClientPermissionsError> {
	return fromConvexTuple(ctx.runQuery(internal.sessions.getDriveSetup, { bookingId }))
		.andThen((setupInfo) => validateDriveSetup(setupInfo))
		.andThen((setupInfo) => {
			const { driveClient, driveSession } = setupInfo;
			const sessionFolder = driveSession?.sessionFolder;
			const rawMediaFolder = driveSession?.rawMediaFolder;
			const assetsFolder = driveSession?.assetsFolder;
			const deliverablesFolder = driveSession?.deliverablesFolder;
			if (
				driveClient === null ||
				driveSession === null ||
				sessionFolder === undefined ||
				rawMediaFolder === undefined ||
				assetsFolder === undefined ||
				deliverablesFolder === undefined
			) {
				return err({ reason: "DRIVE_FOLDERS_NOT_READY" as const });
			}
			return ok({
				...setupInfo,
				driveClient,
				driveSession: {
					_id: driveSession._id,
					assetsFolder,
					deliverablesFolder,
					rawMediaFolder,
					sessionFolder
				}
			});
		});
}

function requireClientDrivePermission(
	drive: DriveClient,
	setup: ReadyBookingDriveFolders,
	requirement: ClientDrivePermissionRequirement
): ResultAsync<null, DriveClientPermissionsError> {
	const clientEmail = normalizeDriveEmail(setup.booking.email);
	return findDrivePermission(drive, {
		email: clientEmail,
		fileId: requirement.fileId,
		role: requirement.role
	})
		.andThen((existingPermission) => {
			if (existingPermission !== null) return ok(existingPermission);
			return createDrivePermission(drive, {
				email: clientEmail,
				fileId: requirement.fileId,
				role: requirement.role,
				sendNotificationEmail: false
			});
		})
		.map(() => null);
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
		.andThen((drive) => {
			const permissions = [
				{ fileId: setup.driveClient.folderId, role: "reader" as const },
				{ fileId: setup.driveSession.assetsFolder.id, role: "writer" as const },
				{ fileId: setup.driveSession.deliverablesFolder.id, role: "commenter" as const }
			] satisfies ClientDrivePermissionRequirement[];

			let result: ResultAsync<null, DriveClientPermissionsError> = okAsync(null);
			for (const permission of permissions) {
				result = result.andThen(() => requireClientDrivePermission(drive, setup, permission));
			}
			return result;
		})
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
								bookingId: claim.bookingId,
								claimedAt: claim.claimedAt,
								status: "sent"
							})
						).mapErr(() => ({ reason: "DRIVE_CLIENT_PERMISSIONS_SAVE_FAILED" as const }))
					)
					.orElse((emailError) =>
						fromConvexTuple(
							ctx.runMutation(internal.sessions.saveClientAssetsEmailResult, {
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
