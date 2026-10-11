"use node";

import { err, ok, okAsync, type ResultAsync } from "neverthrow";
import type { drive_v3 } from "googleapis";
import {
	createDriveFolderRequest,
	renameDriveFolderRequest,
	type DriveClient,
	type DriveError,
	type SavedDriveFolder
} from "#convex/drive/lib/googleDrive";

export function renameDriveFolderIfNameChanged(
	drive: DriveClient,
	expectedName: string | null,
	folder: SavedDriveFolder | null
): ResultAsync<drive_v3.Schema$File | null, DriveError> {
	if (expectedName === null || folder === null) return okAsync(null);

	if (folder.name === expectedName) return okAsync(folder);

	return renameDriveFolderRequest(drive, { folderId: folder.id, name: expectedName }).map(
		(response) => response.data
	);
}

export function createDriveFolderIfAbsent(
	drive: DriveClient,
	input: Parameters<typeof createDriveFolderRequest>[1] | null,
	existing: SavedDriveFolder | null
): ResultAsync<drive_v3.Schema$File | null, DriveError> {
	if (input === null) return okAsync(null);

	if (existing !== null) return okAsync(existing);

	return createDriveFolderRequest(drive, input).map((response) => response.data);
}

export function recoverCreatedDriveFolder(
	folder: SavedDriveFolder | null,
	createError: DriveError
) {
	if (folder === null) return err(createError);

	return ok(folder);
}
