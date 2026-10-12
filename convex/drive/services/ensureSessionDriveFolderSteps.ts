"use node";

import type { ActionCtx } from "#convex/_generated/server";
import type { DriveSetupInfo, SetupError } from "#convex/drive/lib/sessionFolders/driveSetupInfo";
import type { ResultAsync } from "neverthrow";
import { ok, safeTry } from "neverthrow";
import { linkBookingDriveClientRow } from "#convex/drive/lib/driveFolderMutations";
import { getOrCreateClientAssetsFolder as createClientAssetsFolder } from "#convex/drive/services/ensureSessionDriveFolderClientSteps";
import {
	type ClientFolderSetup,
	type SavedFolder,
	type SessionFolderSetup
} from "#convex/drive/services/ensureSessionDriveFolderHelpers";
import {
	allocateSessionFolderNumberIfNeeded,
	getOrCreateSessionFolder as createSessionFolder,
	getOrCreateSessionParentFolder as createSessionParentFolder
} from "#convex/drive/services/ensureSessionDriveFolderSessionSteps";

export function linkBookingDriveClient(
	ctx: ActionCtx,
	setupInfo: DriveSetupInfo,
	client: ClientFolderSetup
): ResultAsync<ClientFolderSetup, SetupError> {
	return safeTry(async function* () {
		yield* linkBookingDriveClientRow(ctx, {
			bookingId: setupInfo.booking._id,
			driveClientId: client.driveClientId
		});

		return ok(client);
	});
}

export function allocateSessionFolderNumber(
	ctx: ActionCtx,
	setupInfo: DriveSetupInfo,
	client: ClientFolderSetup
): ResultAsync<{ client: ClientFolderSetup; sessionFolderNumber: number }, SetupError> {
	return safeTry(async function* () {
		const sessionFolderNumber = yield* allocateSessionFolderNumberIfNeeded(ctx, setupInfo);

		return ok({ client, sessionFolderNumber });
	});
}

export function getOrCreateNumberedClientAssetsFolder(
	ctx: ActionCtx,
	setupInfo: DriveSetupInfo,
	replaceMissingFolders: boolean,

	{ client, sessionFolderNumber }: { client: ClientFolderSetup; sessionFolderNumber: number }
): ResultAsync<
	{ client: ClientFolderSetup & { assetsFolder: SavedFolder }; sessionFolderNumber: number },
	SetupError
> {
	return safeTry(async function* () {
		const assignedClient = yield* createClientAssetsFolder(
			ctx,
			setupInfo,
			client,
			replaceMissingFolders
		);

		return ok({ client: assignedClient, sessionFolderNumber });
	});
}

export function getOrCreateNumberedSessionParentFolder(
	ctx: ActionCtx,
	setupInfo: DriveSetupInfo,
	replaceMissingFolders: boolean,

	{
		client,
		sessionFolderNumber
	}: { client: ClientFolderSetup & { assetsFolder: SavedFolder }; sessionFolderNumber: number }
): ResultAsync<
	{ parent: ClientFolderSetup & { sessionParentId: string }; sessionFolderNumber: number },
	SetupError
> {
	return safeTry(async function* () {
		const parent = yield* createSessionParentFolder(ctx, setupInfo, client, replaceMissingFolders);

		return ok({ parent, sessionFolderNumber });
	});
}

export function getOrCreateNumberedSessionFolder(
	ctx: ActionCtx,
	setupInfo: DriveSetupInfo,
	replaceMissingFolders: boolean,

	{
		parent,
		sessionFolderNumber
	}: { parent: ClientFolderSetup & { sessionParentId: string }; sessionFolderNumber: number }
): ResultAsync<SessionFolderSetup, SetupError> {
	return createSessionFolder(ctx, setupInfo, {
		drive: parent.drive,
		driveClientId: parent.driveClientId,
		sessionParentId: parent.sessionParentId,
		sessionFolderNumber,
		replaceMissingFolders
	});
}
