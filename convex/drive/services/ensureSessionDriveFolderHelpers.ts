"use node";

import {
	renameDriveFolderIfNameChanged,
	createDriveFolderIfAbsent,
	recoverCreatedDriveFolder
} from "#convex/drive/lib/folderRecovery";
import type { Id } from "#convex/_generated/dataModel";
import type { SetupError } from "#convex/drive/lib/sessionFolders/driveSetupInfo";
import { type ResultAsync } from "neverthrow";
import { ok, safeTry } from "neverthrow";
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
	return safeTry(async function* () {
		const folder = yield* verifyDriveFolderIfPresent(drive, input?.folderId ?? null);

		const renamedFolder = yield* renameDriveFolderIfNameChanged(
			drive,
			input?.expectedName ?? null,
			folder
		);

		const savedFolder = yield* parseDriveFolderValueIfAvailable(renamedFolder);

		return ok(savedFolder);
	});
}

// If Google's create response is lost, find the folder by its private booking marker.
export function createFolderOrFindCreatedFolder(
	drive: DriveClient,
	input: { name: string; parentId: string; marker: string } | null
): ResultAsync<SavedDriveFolder | null, SetupError> {
	return safeTry(async function* () {
		const folder = yield* findDriveFolderByMarker(drive, input);

		const createdFolder = yield* createDriveFolderIfAbsent(drive, input, folder).orElse(
			(createError) => findCreatedFolderAfterLostResponse(drive, input, createError)
		);

		const parsedFolder = yield* parseDriveFolderValueIfAvailable(createdFolder);

		return ok(parsedFolder);
	});
}

function findCreatedFolderAfterLostResponse(
	drive: DriveClient,
	input: Parameters<typeof createFolderOrFindCreatedFolder>[1],
	createError: Parameters<typeof recoverCreatedDriveFolder>[1]
) {
	return safeTry(async function* () {
		const found = yield* findDriveFolderByMarker(drive, input);
		const recovered = yield* recoverCreatedDriveFolder(found, createError);

		return ok(recovered);
	});
}
