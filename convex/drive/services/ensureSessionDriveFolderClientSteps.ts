"use node";

import { ok, safeTry } from "neverthrow";
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
	type ClientFolderSetup
} from "#convex/drive/services/ensureSessionDriveFolderHelpers";

export function getOrCreateClientFolder(
	ctx: ActionCtx,
	setupInfo: DriveSetupInfo,
	drive: DriveClient,
	replaceMissingFolders: boolean
) {
	const savedClient = setupInfo.driveClient;
	const savedClientFolderId = savedClient?.folderId ?? null;
	const identity = getClientIdentity(setupInfo);

	const createArgs = {
		name: identity.displayName,
		parentId: env.GOOGLE_DRIVE_ROOT_FOLDER_ID,
		marker: `client:${identity.normalizedEmail}`
	};

	return safeTry(async function* () {
		const verifiedFolder = yield* verifyDriveFolderIfPresent(drive, savedClientFolderId).orElse(
			(error) => resetMissingClientFolder(ctx, setupInfo, replaceMissingFolders, error)
		);

		const createdFolder = yield* createFolderOrFindCreatedFolder(
			drive,
			verifiedFolder === null ? createArgs : null
		);

		const folder = yield* requireSavedDriveFolder(verifiedFolder ?? createdFolder);

		const createdClient = yield* saveDriveClientFolderRowIfRequested(
			ctx,
			setupInfo.driveClient?.folderId === undefined ? { ...identity, folder } : null
		);

		return ok(
			yield* clientFolderSetupFromSavedRow(drive, folder, setupInfo.driveClient, createdClient)
		);
	});
}

export function getOrCreateClientAssetsFolder(
	ctx: ActionCtx,
	setupInfo: DriveSetupInfo,
	client: ClientFolderSetup,
	replaceMissingFolders: boolean
) {
	const savedAssetsFolder = client.assetsFolder;
	const identity = getClientIdentity(setupInfo);

	const createArgs = {
		name: "_Assets",
		parentId: client.clientFolderId,
		marker: `client:${identity.normalizedEmail}:assets`
	};

	return safeTry(async function* () {
		const verifiedFolder = yield* verifyDriveFolderIfPresent(
			client.drive,
			savedAssetsFolder?.id ?? null
		).orElse((error) =>
			resetMissingClientAssetsFolder(ctx, setupInfo, client, replaceMissingFolders, error)
		);

		const createdFolder = yield* createFolderOrFindCreatedFolder(
			client.drive,
			verifiedFolder === null ? createArgs : null
		);

		const folder = yield* requireSavedDriveFolder(verifiedFolder ?? createdFolder);

		const assetsFolder = yield* saveDriveClientAssetsFolderRowIfRequested(
			ctx,
			client.assetsFolder === undefined ? { driveClientId: client.driveClientId, folder } : null
		);

		return ok({
			...client,
			assetsFolder: assetsFolder ??
				client.assetsFolder ?? { id: folder.id, url: folder.webViewLink }
		});
	});
}

function resetMissingClientFolder(
	ctx: ActionCtx,
	setupInfo: DriveSetupInfo,
	replaceMissingFolders: boolean,
	error: SetupError
) {
	return safeTry(async function* () {
		yield* shouldReplaceMissingFolder(error, replaceMissingFolders);
		yield* clearDriveClientFolderRow(
			ctx,
			setupInfo.driveClient === null ? null : { driveClientId: setupInfo.driveClient._id }
		);
		clearMissingClientFolder(setupInfo);

		return ok(null);
	});
}

function resetMissingClientAssetsFolder(
	ctx: ActionCtx,
	setupInfo: DriveSetupInfo,
	client: ClientFolderSetup,
	replaceMissingFolders: boolean,
	error: SetupError
) {
	return safeTry(async function* () {
		yield* shouldReplaceMissingFolder(error, replaceMissingFolders);
		yield* clearDriveClientAssetsFolderRow(ctx, { driveClientId: client.driveClientId });
		clearMissingClientAssetsFolder(setupInfo, client);

		return ok(null);
	});
}
