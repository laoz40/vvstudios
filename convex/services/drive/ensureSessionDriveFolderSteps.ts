"use node";

import { internal } from "#convex/_generated/api";
import type { ActionCtx } from "#convex/_generated/server";
import type { DriveSetupInfo } from "#convex/lib/drive/sessionFolders/driveSetupInfo";
import { fromConvexTuple } from "#convex/lib/result";
import type { DriveClient } from "#convex/lib/drive/googleDrive";
import {
	getOrCreateClientAssetsFolder,
	getOrCreateClientFolder
} from "#convex/services/drive/ensureSessionDriveFolderClientSteps";
import {
	type ClientFolderSetup,
	type SavedFolder,
	type SessionFolderSetup
} from "#convex/services/drive/ensureSessionDriveFolderHelpers";
import {
	allocateSessionFolderNumberIfNeeded,
	getOrCreateChildFolders,
	getOrCreateSessionFolder,
	getOrCreateSessionParentFolder
} from "#convex/services/drive/ensureSessionDriveFolderSessionSteps";

export function getOrCreateClientFolderStep(
	ctx: ActionCtx,
	setupInfo: DriveSetupInfo,
	replaceMissingFolders: boolean
) {
	return (drive: DriveClient) =>
		getOrCreateClientFolder(ctx, setupInfo, drive, replaceMissingFolders);
}

export function linkBookingDriveClientStep(ctx: ActionCtx, setupInfo: DriveSetupInfo) {
	return (client: ClientFolderSetup) =>
		fromConvexTuple(
			ctx.runMutation(internal.sessionsDriveInternal.linkBookingDriveClient, {
				bookingId: setupInfo.booking._id,
				driveClientId: client.driveClientId
			})
		).map(returnClient(client));
}

function returnClient<T>(client: T) {
	return () => client;
}

export function allocateSessionFolderNumberStep(ctx: ActionCtx, setupInfo: DriveSetupInfo) {
	return (client: ClientFolderSetup) =>
		allocateSessionFolderNumberIfNeeded(ctx, setupInfo).map(
			mapClientWithSessionFolderNumber(client)
		);
}

function mapClientWithSessionFolderNumber(client: ClientFolderSetup) {
	return (sessionFolderNumber: number) => ({ client, sessionFolderNumber });
}

export function getOrCreateClientAssetsFolderStep(
	ctx: ActionCtx,
	setupInfo: DriveSetupInfo,
	replaceMissingFolders: boolean
) {
	return ({
		client,
		sessionFolderNumber
	}: {
		client: ClientFolderSetup;
		sessionFolderNumber: number;
	}) =>
		getOrCreateClientAssetsFolder(ctx, setupInfo, client, replaceMissingFolders).map(
			mapClientAssetsWithSessionNumber(sessionFolderNumber)
		);
}

function mapClientAssetsWithSessionNumber(sessionFolderNumber: number) {
	return (clientWithAssets: ClientFolderSetup & { assetsFolder: SavedFolder }) => ({
		client: clientWithAssets,
		sessionFolderNumber
	});
}

export function getOrCreateSessionParentFolderStep(
	ctx: ActionCtx,
	setupInfo: DriveSetupInfo,
	replaceMissingFolders: boolean
) {
	return ({
		client,
		sessionFolderNumber
	}: {
		client: ClientFolderSetup & { assetsFolder: SavedFolder };
		sessionFolderNumber: number;
	}) =>
		getOrCreateSessionParentFolder(ctx, setupInfo, client, replaceMissingFolders).map(
			mapSessionParentWithFolderNumber(sessionFolderNumber)
		);
}

function mapSessionParentWithFolderNumber(sessionFolderNumber: number) {
	return (parent: ClientFolderSetup & { sessionParentId: string }) => ({
		parent,
		sessionFolderNumber
	});
}

export function getOrCreateSessionFolderStep(
	ctx: ActionCtx,
	setupInfo: DriveSetupInfo,
	replaceMissingFolders: boolean
) {
	return ({
		parent,
		sessionFolderNumber
	}: {
		parent: ClientFolderSetup & { sessionParentId: string };
		sessionFolderNumber: number;
	}) =>
		getOrCreateSessionFolder(ctx, setupInfo, {
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
	replaceMissingFolders: boolean
) {
	return ({ drive, sessionFolderId }: SessionFolderSetup) =>
		getOrCreateChildFolders(ctx, drive, setupInfo, sessionFolderId, replaceMissingFolders);
}
