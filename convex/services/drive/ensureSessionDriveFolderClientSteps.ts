"use node";

import { err } from "neverthrow";
import type { ResultAsync } from "neverthrow";
import { internal } from "#convex/_generated/api";
import type { Id } from "#convex/_generated/dataModel";
import type { ActionCtx } from "#convex/_generated/server";
import { env } from "#convex/env";
import type { DriveSetupInfo, SetupError } from "#convex/lib/drive/sessionFolders/driveSetupInfo";
import { fromConvexTuple } from "#convex/lib/result";
import {
	verifyDriveFolder,
	type DriveClient,
	type SavedDriveFolder
} from "#convex/lib/drive/googleDrive";
import {
	clearSavedClientAssetsFolder,
	clearSavedClientFolder,
	createFolderOrFindCreatedFolder,
	getClientIdentity,
	shouldReplaceMissingFolder,
	type ClientFolderSetup,
	type SavedFolder
} from "#convex/services/drive/ensureSessionDriveFolderHelpers";

function mapVerifiedExistingClientFolder(
	drive: DriveClient,
	savedClient: NonNullable<DriveSetupInfo["driveClient"]>,
	savedClientFolderId: string
) {
	return () => ({
		drive,
		clientFolderId: savedClientFolderId,
		driveClientId: savedClient._id,
		assetsFolder: savedClient.assetsFolder
	});
}

function recreateClientFolderAfterMissing(
	ctx: ActionCtx,
	setupInfo: DriveSetupInfo,
	drive: DriveClient,
	replaceMissingFolders: boolean,
	savedClient: NonNullable<DriveSetupInfo["driveClient"]>
) {
	return (error: SetupError) => {
		if (!shouldReplaceMissingFolder(error, replaceMissingFolders)) return err(error);
		savedClient.folderId = undefined;

		return clearSavedClientFolder(ctx, savedClient._id).andThen(
			recreateClientFolderStep(ctx, setupInfo, drive, replaceMissingFolders)
		);
	};
}

function recreateClientFolderStep(
	ctx: ActionCtx,
	setupInfo: DriveSetupInfo,
	drive: DriveClient,
	replaceMissingFolders: boolean
) {
	return () => getOrCreateClientFolder(ctx, setupInfo, drive, replaceMissingFolders);
}

function saveCreatedClientFolder(
	ctx: ActionCtx,
	drive: DriveClient,
	normalizedEmail: string,
	displayName: string
) {
	return (folder: SavedDriveFolder) =>
		fromConvexTuple(
			ctx.runMutation(internal.sessionsDriveInternal.saveDriveClientFolder, {
				normalizedEmail,
				displayName,
				folder
			})
		).map(mapSavedClientFolderSetup(drive));
}

function mapSavedClientFolderSetup(drive: DriveClient) {
	return ({
		assetsFolder,
		driveClientId,
		folderId
	}: {
		assetsFolder: SavedFolder | undefined;
		driveClientId: Id<"driveClients">;
		folderId: string;
	}) => ({ drive, clientFolderId: folderId, driveClientId, assetsFolder });
}

export function getOrCreateClientFolder(
	ctx: ActionCtx,
	setupInfo: DriveSetupInfo,
	drive: DriveClient,
	replaceMissingFolders: boolean
): ResultAsync<ClientFolderSetup, SetupError> {
	const savedClient = setupInfo.driveClient;
	const savedClientFolderId = savedClient?.folderId;

	if (savedClient !== null && savedClientFolderId !== undefined) {
		return verifyDriveFolder(drive, savedClientFolderId)
			.map(mapVerifiedExistingClientFolder(drive, savedClient, savedClientFolderId))
			.orElse(
				recreateClientFolderAfterMissing(ctx, setupInfo, drive, replaceMissingFolders, savedClient)
			);
	}

	const { displayName, normalizedEmail } = getClientIdentity(setupInfo);

	return createFolderOrFindCreatedFolder(drive, {
		name: displayName,
		parentId: env.GOOGLE_DRIVE_ROOT_FOLDER_ID,
		marker: `client:${normalizedEmail}`
	}).andThen(saveCreatedClientFolder(ctx, drive, normalizedEmail, displayName));
}

function mapClientWithExistingAssetsFolder(
	client: ClientFolderSetup,
	savedAssetsFolder: SavedFolder
) {
	return () => ({ ...client, assetsFolder: savedAssetsFolder });
}

function recreateClientAssetsFolderAfterMissing(
	ctx: ActionCtx,
	setupInfo: DriveSetupInfo,
	client: ClientFolderSetup,
	replaceMissingFolders: boolean
) {
	return (error: SetupError) => {
		if (!shouldReplaceMissingFolder(error, replaceMissingFolders)) return err(error);
		client.assetsFolder = undefined;

		if (setupInfo.driveClient !== null) setupInfo.driveClient.assetsFolder = undefined;

		return clearSavedClientAssetsFolder(ctx, client.driveClientId).andThen(
			recreateClientAssetsFolderStep(ctx, setupInfo, client, replaceMissingFolders)
		);
	};
}

function recreateClientAssetsFolderStep(
	ctx: ActionCtx,
	setupInfo: DriveSetupInfo,
	client: ClientFolderSetup,
	replaceMissingFolders: boolean
) {
	return () => getOrCreateClientAssetsFolder(ctx, setupInfo, client, replaceMissingFolders);
}

function saveCreatedClientAssetsFolder(ctx: ActionCtx, client: ClientFolderSetup) {
	return (folder: SavedDriveFolder) =>
		fromConvexTuple(
			ctx.runMutation(internal.sessionsDriveInternal.saveDriveClientAssetsFolder, {
				driveClientId: client.driveClientId,
				folder
			})
		);
}

function mapClientWithSavedAssetsFolder(client: ClientFolderSetup) {
	return (assetsFolder: SavedFolder) => ({ ...client, assetsFolder });
}

export function getOrCreateClientAssetsFolder(
	ctx: ActionCtx,
	setupInfo: DriveSetupInfo,
	client: ClientFolderSetup,
	replaceMissingFolders: boolean
): ResultAsync<ClientFolderSetup & { assetsFolder: SavedFolder }, SetupError> {
	const savedAssetsFolder = client.assetsFolder;

	if (savedAssetsFolder !== undefined) {
		return verifyDriveFolder(client.drive, savedAssetsFolder.id)
			.map(mapClientWithExistingAssetsFolder(client, savedAssetsFolder))
			.orElse(
				recreateClientAssetsFolderAfterMissing(ctx, setupInfo, client, replaceMissingFolders)
			);
	}

	return createFolderOrFindCreatedFolder(client.drive, {
		name: "_Assets",
		parentId: client.clientFolderId,
		marker: `client:${getClientIdentity(setupInfo).normalizedEmail}:assets`
	})
		.andThen(saveCreatedClientAssetsFolder(ctx, client))
		.map(mapClientWithSavedAssetsFolder(client));
}
