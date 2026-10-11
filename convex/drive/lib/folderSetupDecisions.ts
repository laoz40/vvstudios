"use node";

import { getClientFolderName, normalizeDriveEmail } from "#convex/drive/lib/googleDrive";
import type { DriveSetupInfo, SetupError } from "#convex/drive/lib/sessionFolders/driveSetupInfo";
import { err, ok, type Result } from "neverthrow";
import type { SavedDriveFolder } from "#convex/drive/lib/googleDrive";
import type { DriveClient } from "#convex/drive/lib/googleDrive";
import type { Id } from "#convex/_generated/dataModel";

export function getClientIdentity(setupInfo: DriveSetupInfo) {
	return setupInfo.driveClient === null
		? {
				displayName: getClientFolderName({
					accountName: setupInfo.booking.accountName,
					contactName: setupInfo.booking.name
				}),
				normalizedEmail: normalizeDriveEmail(setupInfo.booking.email)
			}
		: {
				displayName: setupInfo.driveClient.displayName,
				normalizedEmail: setupInfo.driveClient.normalizedEmail
			};
}

export function shouldReplaceMissingFolder(
	error: SetupError,
	replaceMissingFolders: boolean
): Result<null, SetupError> {
	return replaceMissingFolders && error.reason === "GOOGLE_DRIVE_FOLDER_MISSING"
		? ok(null)
		: err(error);
}

export function requireSavedDriveFolder(
	folder: SavedDriveFolder | null
): Result<SavedDriveFolder, SetupError> {
	return folder === null ? err({ reason: "DRIVE_RECORD_NOT_FOUND" }) : ok(folder);
}

export function clientFolderSetupFromSavedRow(
	drive: DriveClient,
	folder: SavedDriveFolder,
	savedClient: DriveSetupInfo["driveClient"],
	createdClient: {
		driveClientId: Id<"driveClients">;
		folderId: string;
		assetsFolder: { id: string; url: string } | undefined;
	} | null
) {
	const driveClientId = createdClient?.driveClientId ?? savedClient?._id;

	return driveClientId === undefined
		? err({ reason: "DRIVE_RECORD_NOT_FOUND" as const })
		: ok({
				drive,
				clientFolderId: createdClient?.folderId ?? folder.id,
				driveClientId,
				assetsFolder:
					createdClient === null ? savedClient?.assetsFolder : createdClient.assetsFolder
			});
}
