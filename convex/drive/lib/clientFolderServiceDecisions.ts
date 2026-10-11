"use node";

import type { Id } from "#convex/_generated/dataModel";
import type { DriveSetupInfo } from "#convex/drive/lib/sessionFolders/driveSetupInfo";
import type { DriveClient } from "#convex/drive/lib/googleDrive";

type SavedFolder = { id: string; url: string };

type ClientFolderSetup = {
	drive: DriveClient;
	clientFolderId: string;
	driveClientId: Id<"driveClients">;
	assetsFolder?: SavedFolder;
};

export function clearMissingClientFolder(setupInfo: DriveSetupInfo) {
	if (setupInfo.driveClient !== null) setupInfo.driveClient.folderId = undefined;

	return setupInfo;
}

export function clearMissingClientAssetsFolder(
	setupInfo: DriveSetupInfo,
	client: ClientFolderSetup
) {
	client.assetsFolder = undefined;

	if (setupInfo.driveClient !== null) setupInfo.driveClient.assetsFolder = undefined;

	return client;
}
