"use node";

import { internal } from "#convex/_generated/api";
import type { ActionCtx } from "#convex/_generated/server";
import type { DriveSetupInfo } from "#convex/drive/lib/sessionFolders/driveSetupInfo";
import { fromConvexTuple } from "#convex/shared/lib/result";
import type { DriveClient } from "#convex/drive/lib/googleDrive";
import {
	getOrCreateClientAssetsFolder,
	getOrCreateClientFolder
} from "#convex/drive/services/ensureSessionDriveFolderClientSteps";
import {
	type ClientFolderSetup,
	type SavedFolder,
	type SessionFolderSetup
} from "#convex/drive/services/ensureSessionDriveFolderHelpers";
import {
	allocateSessionFolderNumberIfNeeded,
	getOrCreateChildFolders,
	getOrCreateSessionFolder,
	getOrCreateSessionParentFolder
} from "#convex/drive/services/ensureSessionDriveFolderSessionSteps";

export function getOrCreateClientFolderStep(
	ctx: ActionCtx,
	setupInfo: DriveSetupInfo,
	replaceMissingFolders: boolean,

	drive: DriveClient
) {
	return getOrCreateClientFolder(ctx, setupInfo, drive, replaceMissingFolders);
}

export function linkBookingDriveClientStep(
	ctx: ActionCtx,
	setupInfo: DriveSetupInfo,
	client: ClientFolderSetup
) {
	return fromConvexTuple(
		ctx.runMutation(internal.sessions.sessionsDriveInternal.linkBookingDriveClient, {
			bookingId: setupInfo.booking._id,
			driveClientId: client.driveClientId
		})
	).map(() => returnClient(client));
}

function returnClient<T>(client: T) {
	return client;
}

export function allocateSessionFolderNumberStep(
	ctx: ActionCtx,
	setupInfo: DriveSetupInfo,
	client: ClientFolderSetup
) {
	return allocateSessionFolderNumberIfNeeded(ctx, setupInfo).map((sessionFolderNumber: number) =>
		mapClientWithSessionFolderNumber(client, sessionFolderNumber)
	);
}

function mapClientWithSessionFolderNumber(client: ClientFolderSetup, sessionFolderNumber: number) {
	return { client, sessionFolderNumber };
}

export function getOrCreateClientAssetsFolderStep(
	ctx: ActionCtx,
	setupInfo: DriveSetupInfo,
	replaceMissingFolders: boolean,

	{ client, sessionFolderNumber }: { client: ClientFolderSetup; sessionFolderNumber: number }
) {
	return getOrCreateClientAssetsFolder(ctx, setupInfo, client, replaceMissingFolders).map(
		(clientWithAssets: ClientFolderSetup & { assetsFolder: SavedFolder }) =>
			mapClientAssetsWithSessionNumber(sessionFolderNumber, clientWithAssets)
	);
}

function mapClientAssetsWithSessionNumber(
	sessionFolderNumber: number,
	clientWithAssets: ClientFolderSetup & { assetsFolder: SavedFolder }
) {
	return { client: clientWithAssets, sessionFolderNumber };
}

export function getOrCreateSessionParentFolderStep(
	ctx: ActionCtx,
	setupInfo: DriveSetupInfo,
	replaceMissingFolders: boolean,

	{
		client,
		sessionFolderNumber
	}: { client: ClientFolderSetup & { assetsFolder: SavedFolder }; sessionFolderNumber: number }
) {
	return getOrCreateSessionParentFolder(ctx, setupInfo, client, replaceMissingFolders).map(
		(parent: ClientFolderSetup & { sessionParentId: string }) =>
			mapSessionParentWithFolderNumber(sessionFolderNumber, parent)
	);
}

function mapSessionParentWithFolderNumber(
	sessionFolderNumber: number,
	parent: ClientFolderSetup & { sessionParentId: string }
) {
	return { parent, sessionFolderNumber };
}

export function getOrCreateSessionFolderStep(
	ctx: ActionCtx,
	setupInfo: DriveSetupInfo,
	replaceMissingFolders: boolean,

	{
		parent,
		sessionFolderNumber
	}: { parent: ClientFolderSetup & { sessionParentId: string }; sessionFolderNumber: number }
) {
	return getOrCreateSessionFolder(ctx, setupInfo, {
		drive: parent.drive,
		driveClientId: parent.driveClientId,
		sessionParentId: parent.sessionParentId,
		sessionFolderNumber,
		replaceMissingFolders
	});
}

export function getOrCreateChildFoldersStep(
	ctx: ActionCtx,
	setupInfo: DriveSetupInfo,
	replaceMissingFolders: boolean,

	{ drive, sessionFolderId }: SessionFolderSetup
) {
	return getOrCreateChildFolders(ctx, drive, setupInfo, sessionFolderId, replaceMissingFolders);
}
