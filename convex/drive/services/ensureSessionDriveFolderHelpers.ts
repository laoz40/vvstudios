"use node";

import { err, ok } from "neverthrow";
import { internal } from "#convex/_generated/api";
import type { Id } from "#convex/_generated/dataModel";
import type { ActionCtx } from "#convex/_generated/server";
import type { DriveSetupInfo, SetupError } from "#convex/drive/lib/sessionFolders/driveSetupInfo";
import { fromConvexTuple } from "#convex/shared/lib/result";
import {
	createDriveFolder,
	findDriveFolderByMarker,
	getClientFolderName,
	normalizeDriveEmail,
	renameDriveFolder,
	verifyDriveFolder,
	type DriveChildFolderName,
	type DriveClient,
	type SavedDriveFolder
} from "#convex/drive/lib/googleDrive";

export type SavedFolder = { id: string; url: string };

export type ClientFolderSetup = {
	drive: DriveClient;
	clientFolderId: string;
	driveClientId: Id<"driveClients">;
	assetsFolder?: SavedFolder;
};

export type SessionFolderSetup = { drive: DriveClient; sessionFolderId: string };

export function buildFolderMarker(bookingId: Id<"bookings">, role: string) {
	return `${bookingId}:${role}`;
}

export function getClientIdentity(setupInfo: DriveSetupInfo) {
	if (setupInfo.driveClient !== null) {
		return {
			displayName: setupInfo.driveClient.displayName,
			normalizedEmail: setupInfo.driveClient.normalizedEmail
		};
	}

	return {
		displayName: getClientFolderName({
			accountName: setupInfo.booking.accountName,
			contactName: setupInfo.booking.name
		}),
		normalizedEmail: normalizeDriveEmail(setupInfo.booking.email)
	};
}

function renameDriveFolderWhenNameDiffers(
	drive: DriveClient,
	expectedName: string,
	folder: SavedDriveFolder
) {
	if (folder.name === expectedName) return ok(folder);

	return renameDriveFolder(drive, { folderId: folder.id, name: expectedName });
}

export function verifyAndRenameDriveFolder(
	drive: DriveClient,
	folderId: string,
	expectedName: string
) {
	return verifyDriveFolder(drive, folderId).andThen((folder: SavedDriveFolder) =>
		renameDriveFolderWhenNameDiffers(drive, expectedName, folder)
	);
}

// If Google's create response is lost, find the folder by its private booking marker.
export function createFolderOrFindCreatedFolder(
	drive: DriveClient,
	input: { name: string; parentId: string; marker: string }
) {
	return findDriveFolderByMarker(drive, input).andThen((folder: SavedDriveFolder | null) =>
		createFolderWhenMarkerMissing(drive, input, folder)
	);
}

function createFolderWhenMarkerMissing(
	drive: DriveClient,
	input: Parameters<typeof createDriveFolder>[1],
	folder: SavedDriveFolder | null
) {
	if (folder !== null) return ok(folder);

	return createDriveFolder(drive, input).orElse((createError: SetupError) =>
		recoverCreatedFolderAfterCreateFailure(drive, input, createError)
	);
}

function recoverCreatedFolderAfterCreateFailure(
	drive: DriveClient,
	input: Parameters<typeof createDriveFolder>[1],
	createError: SetupError
) {
	return findDriveFolderByMarker(drive, input).andThen((foundFolder: SavedDriveFolder | null) =>
		resolveRecoveredFolderOrCreateError(createError, foundFolder)
	);
}

function resolveRecoveredFolderOrCreateError(
	createError: SetupError,
	foundFolder: SavedDriveFolder | null
) {
	return foundFolder === null ? err(createError) : ok(foundFolder);
}

export function shouldReplaceMissingFolder(error: SetupError, replaceMissingFolders: boolean) {
	return replaceMissingFolders && error.reason === "GOOGLE_DRIVE_FOLDER_MISSING";
}

export function clearSavedClientFolder(ctx: ActionCtx, driveClientId: Id<"driveClients">) {
	return fromConvexTuple(
		ctx.runMutation(internal.sessions.sessionsDriveInternal.clearDriveClientFolder, {
			driveClientId
		})
	);
}

export function clearSavedClientAssetsFolder(ctx: ActionCtx, driveClientId: Id<"driveClients">) {
	return fromConvexTuple(
		ctx.runMutation(internal.sessions.sessionsDriveInternal.clearDriveClientAssetsFolder, {
			driveClientId
		})
	);
}

export function clearSavedPackageFolder(ctx: ActionCtx, bookingId: Id<"bookings">) {
	return fromConvexTuple(
		ctx.runMutation(internal.sessions.sessionsDriveInternal.clearDrivePackageFolder, { bookingId })
	);
}

export function clearSavedSessionFolder(ctx: ActionCtx, bookingId: Id<"bookings">) {
	return fromConvexTuple(
		ctx.runMutation(internal.sessions.sessionsDriveInternal.clearDriveSessionFolder, { bookingId })
	);
}

export function clearSavedChildFolder(
	ctx: ActionCtx,
	bookingId: Id<"bookings">,
	name: DriveChildFolderName
) {
	return fromConvexTuple(
		ctx.runMutation(internal.sessions.sessionsDriveInternal.clearDriveChildFolder, {
			bookingId,
			name
		})
	);
}

export function returnNull(): null {
	return null;
}
