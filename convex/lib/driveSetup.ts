"use node";

import { ResultAsync, err, ok } from "neverthrow";
import { internal } from "#convex/_generated/api";
import type { Doc, Id } from "#convex/_generated/dataModel";
import type { ActionCtx } from "#convex/_generated/server";
import { env } from "#convex/env";
import { fromConvexTuple } from "#convex/lib/result";
import {
	createDriveFolder,
	getClientFolderName,
	getSessionFolderName,
	limitRawMediaFolderAccess,
	loadDriveClient,
	normalizeDriveEmail,
	GOOGLE_DRIVE_CHILD_FOLDER_NAMES,
	type DriveClient,
	type DriveError
} from "#convex/lib/googleDrive";

export type DriveSetupInfo = {
	booking: {
		_id: Id<"bookings">;
		name: string;
		accountName: string;
		email: string;
		sessionStartAt: number;
		status: Doc<"bookings">["status"];
		multiBookingPackageId?: Id<"multiBookingPackages">;
	};
	driveClient: { _id: Id<"driveClients">; folderId: string } | null;
	driveSession: { _id: Id<"driveSessions"> } | null;
};

export type SetupError =
	| DriveError
	| {
			reason:
				| "NOT_AUTHENTICATED"
				| "NOT_AUTHORIZED"
				| "DRIVE_RECORD_NOT_FOUND"
				| "BOOKING_NOT_FOUND"
				| "BOOKING_NOT_ELIGIBLE"
				| "PACKAGE_SESSION_NOT_SUPPORTED"
				| "DRIVE_FOLDERS_ALREADY_CREATED"
				| "GOOGLE_DRIVE_SAVE_FAILED";
	  };

export function validateDriveSetup(setupInfo: DriveSetupInfo | null) {
	if (setupInfo === null) return err({ reason: "BOOKING_NOT_FOUND" as const });
	if (setupInfo.booking.multiBookingPackageId !== undefined) {
		return err({ reason: "PACKAGE_SESSION_NOT_SUPPORTED" as const });
	}
	if (setupInfo.booking.status !== "confirmed" && setupInfo.booking.status !== "email_failed") {
		return err({ reason: "BOOKING_NOT_ELIGIBLE" as const });
	}
	if (setupInfo.driveSession !== null) {
		return err({ reason: "DRIVE_FOLDERS_ALREADY_CREATED" as const });
	}
	return ok(setupInfo);
}

function getOrCreateClientFolder(ctx: ActionCtx, setupInfo: DriveSetupInfo, drive: DriveClient) {
	if (setupInfo.driveClient !== null) {
		return ok({
			drive,
			clientFolderId: setupInfo.driveClient.folderId,
			driveClientId: setupInfo.driveClient._id
		});
	}

	const displayName = getClientFolderName({
		accountName: setupInfo.booking.accountName,
		contactName: setupInfo.booking.name
	});
	return createDriveFolder(drive, { name: displayName, parentId: env.GOOGLE_DRIVE_ROOT_FOLDER_ID })
		.andThen((folder) =>
			fromConvexTuple(
				ctx.runMutation(internal.sessions.saveDriveClientFolder, {
					normalizedEmail: normalizeDriveEmail(setupInfo.booking.email),
					displayName,
					folder
				})
			)
				.mapErr(() => ({ reason: "GOOGLE_DRIVE_SAVE_FAILED" as const }))
				.map((driveClientId) => ({ folder, driveClientId }))
		)
		.map(({ folder, driveClientId }) => ({ drive, clientFolderId: folder.id, driveClientId }));
}

function createSessionFolder(
	ctx: ActionCtx,
	bookingId: Id<"bookings">,
	sessionStartAt: number,
	client: { drive: DriveClient; clientFolderId: string; driveClientId: Id<"driveClients"> }
) {
	return createDriveFolder(client.drive, {
		name: getSessionFolderName(sessionStartAt),
		parentId: client.clientFolderId
	}).andThen((folder) =>
		fromConvexTuple(
			ctx.runMutation(internal.sessions.saveDriveSessionFolder, {
				bookingId,
				driveClientId: client.driveClientId,
				folder
			})
		)
			.mapErr(() => ({ reason: "GOOGLE_DRIVE_SAVE_FAILED" as const }))
			.map(() => ({ drive: client.drive, sessionFolderId: folder.id }))
	);
}

function createChildrenFolders(
	ctx: ActionCtx,
	drive: DriveClient,
	bookingId: Id<"bookings">,
	sessionFolderId: string
) {
	let folderCreationSequence: ResultAsync<null, SetupError> = ResultAsync.fromSafePromise(
		Promise.resolve(null)
	);
	for (const name of GOOGLE_DRIVE_CHILD_FOLDER_NAMES) {
		folderCreationSequence = folderCreationSequence.andThen(() =>
			createDriveFolder(drive, { name, parentId: sessionFolderId })
				.andThen((folder) =>
					fromConvexTuple(
						ctx.runMutation(internal.sessions.saveDriveChildFolder, { bookingId, name, folder })
					)
						.mapErr(() => ({ reason: "GOOGLE_DRIVE_SAVE_FAILED" as const }))
						.map(() => folder)
				)
				.andThen((folder) => {
					if (name !== "Raw Media") return ok(null);
					return limitRawMediaFolderAccess(drive, folder.id);
				})
		);
	}
	return folderCreationSequence;
}

export function createDriveFolders(
	ctx: ActionCtx,
	bookingId: Id<"bookings">,
	setupInfo: DriveSetupInfo
): ResultAsync<null, SetupError> {
	return loadDriveClient()
		.andThen((drive) => getOrCreateClientFolder(ctx, setupInfo, drive))
		.andThen((client) =>
			createSessionFolder(ctx, bookingId, setupInfo.booking.sessionStartAt, client)
		)
		.andThen(({ drive, sessionFolderId }) =>
			createChildrenFolders(ctx, drive, bookingId, sessionFolderId)
		)
		.map(() => null);
}
