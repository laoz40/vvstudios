"use node";

import type { ResultAsync } from "neverthrow";
import type { ActionCtx } from "#convex/_generated/server";
import { env } from "#convex/env";
import type { DriveSetupInfo, SetupError } from "#convex/drive/lib/sessionFolders/driveSetupInfo";
import {
	clearMissingClientAssetsFolder,
	clearMissingClientFolder
} from "#convex/drive/lib/clientFolderServiceDecisions";
import {
	clientFolderSetupFromSavedRow,
	getClientIdentity,
	requireSavedDriveFolder,
	shouldReplaceMissingFolder
} from "#convex/drive/lib/folderSetupDecisions";
import {
	clearDriveClientAssetsFolderRow,
	clearDriveClientFolderRow,
	saveDriveClientAssetsFolderRowIfRequested,
	saveDriveClientFolderRowIfRequested
} from "#convex/drive/lib/driveFolderMutations";
import type { DriveClient } from "#convex/drive/lib/googleDrive";
import { verifyDriveFolderIfPresent } from "#convex/drive/services/googleDriveOperations";
import {
	createFolderOrFindCreatedFolder,
	type ClientFolderSetup,
	type SavedFolder
} from "#convex/drive/services/ensureSessionDriveFolderHelpers";

export function getOrCreateClientFolder(
	ctx: ActionCtx,
	setupInfo: DriveSetupInfo,
	drive: DriveClient,
	replaceMissingFolders: boolean
): ResultAsync<ClientFolderSetup, SetupError> {
	const savedClient = setupInfo.driveClient;
	const savedClientFolderId = savedClient?.folderId ?? null;
	const identity = getClientIdentity(setupInfo);

	const createArgs = {
		name: identity.displayName,
		parentId: env.GOOGLE_DRIVE_ROOT_FOLDER_ID,
		marker: `client:${identity.normalizedEmail}`
	};

	return verifyDriveFolderIfPresent(drive, savedClientFolderId)
		.orElse((error) =>
			shouldReplaceMissingFolder(error, replaceMissingFolders).asyncAndThen(() =>
				clearDriveClientFolderRow(
					ctx,
					savedClient === null ? null : { driveClientId: savedClient._id }
				).map(() => {
					clearMissingClientFolder(setupInfo);

					return null;
				})
			)
		)
		.andThen((verifiedFolder) =>
			createFolderOrFindCreatedFolder(drive, verifiedFolder === null ? createArgs : null).andThen(
				(createdFolder) =>
					requireSavedDriveFolder(verifiedFolder ?? createdFolder).asyncAndThen((folder) =>
						saveDriveClientFolderRowIfRequested(
							ctx,
							setupInfo.driveClient?.folderId === undefined ? { ...identity, folder } : null
						).andThen((createdClient) =>
							clientFolderSetupFromSavedRow(drive, folder, setupInfo.driveClient, createdClient)
						)
					)
			)
		);
}

export function getOrCreateClientAssetsFolder(
	ctx: ActionCtx,
	setupInfo: DriveSetupInfo,
	client: ClientFolderSetup,
	replaceMissingFolders: boolean
): ResultAsync<ClientFolderSetup & { assetsFolder: SavedFolder }, SetupError> {
	const savedAssetsFolder = client.assetsFolder;
	const identity = getClientIdentity(setupInfo);

	const createArgs = {
		name: "_Assets",
		parentId: client.clientFolderId,
		marker: `client:${identity.normalizedEmail}:assets`
	};

	return verifyDriveFolderIfPresent(client.drive, savedAssetsFolder?.id ?? null)
		.orElse((error) =>
			shouldReplaceMissingFolder(error, replaceMissingFolders).asyncAndThen(() =>
				clearDriveClientAssetsFolderRow(ctx, { driveClientId: client.driveClientId }).map(() => {
					clearMissingClientAssetsFolder(setupInfo, client);

					return null;
				})
			)
		)
		.andThen((verifiedFolder) =>
			createFolderOrFindCreatedFolder(
				client.drive,
				verifiedFolder === null ? createArgs : null
			).andThen((createdFolder) =>
				requireSavedDriveFolder(verifiedFolder ?? createdFolder).asyncAndThen((folder) =>
					saveDriveClientAssetsFolderRowIfRequested(
						ctx,
						client.assetsFolder === undefined
							? { driveClientId: client.driveClientId, folder }
							: null
					).map((assetsFolder) => ({
						...client,
						assetsFolder: assetsFolder ??
							client.assetsFolder ?? { id: folder.id, url: folder.webViewLink }
					}))
				)
			)
		);
}
