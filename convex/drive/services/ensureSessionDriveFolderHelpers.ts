"use node";

import {
	renameDriveFolderIfNameChanged,
	createDriveFolderIfAbsent,
	recoverCreatedDriveFolder
} from "#convex/drive/lib/folderRecovery";
import type { Id } from "#convex/_generated/dataModel";
import type { SetupError } from "#convex/drive/lib/sessionFolders/driveSetupInfo";
import { type ResultAsync } from "neverthrow";
import {
	parseDriveFolderValueIfAvailable,
	type DriveClient,
	type SavedDriveFolder
} from "#convex/drive/lib/googleDrive";
import {
	verifyDriveFolderIfPresent,
	findDriveFolderByMarker
} from "#convex/drive/services/googleDriveOperations";

export type SavedFolder = { id: string; url: string };

export type ClientFolderSetup = {
	drive: DriveClient;
	clientFolderId: string;
	driveClientId: Id<"driveClients">;
	assetsFolder?: SavedFolder;
};

export type SessionFolderSetup = { drive: DriveClient; sessionFolderId: string };

export function verifyAndRenameDriveFolder(
	drive: DriveClient,
	input: { folderId: string; expectedName: string } | null
): ResultAsync<SavedDriveFolder | null, SetupError> {
	return verifyDriveFolderIfPresent(drive, input?.folderId ?? null)
		.andThen((folder) => renameDriveFolderIfNameChanged(drive, input?.expectedName ?? null, folder))
		.andThen(parseDriveFolderValueIfAvailable);
}

// If Google's create response is lost, find the folder by its private booking marker.
export function createFolderOrFindCreatedFolder(
	drive: DriveClient,
	input: { name: string; parentId: string; marker: string } | null
): ResultAsync<SavedDriveFolder | null, SetupError> {
	return findDriveFolderByMarker(drive, input).andThen((folder) =>
		createDriveFolderIfAbsent(drive, input, folder)
			.andThen(parseDriveFolderValueIfAvailable)
			.orElse((createError) =>
				findDriveFolderByMarker(drive, input).andThen((found) =>
					recoverCreatedDriveFolder(found, createError)
				)
			)
	);
}
