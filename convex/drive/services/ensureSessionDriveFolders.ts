"use node";

import type { ResultAsync } from "neverthrow";
import type { ActionCtx } from "#convex/_generated/server";
import type { DriveSetupInfo, SetupError } from "#convex/drive/lib/sessionFolders/driveSetupInfo";
import { loadDriveClient } from "#convex/drive/lib/googleDrive";
import { getOrCreateClientFolder } from "#convex/drive/services/ensureSessionDriveFolderClientSteps";
import { getOrCreateChildFolders } from "#convex/drive/services/ensureSessionDriveFolderSessionSteps";
import {
	allocateSessionFolderNumber,
	getOrCreateNumberedClientAssetsFolder,
	getOrCreateNumberedSessionFolder,
	getOrCreateNumberedSessionParentFolder,
	linkBookingDriveClient
} from "#convex/drive/services/ensureSessionDriveFolderSteps";

export function ensureSessionDriveFolders(
	ctx: ActionCtx,
	setupInfo: DriveSetupInfo,
	replaceMissingFolders = false
): ResultAsync<null, SetupError> {
	return loadDriveClient()
		.andThen((drive) => getOrCreateClientFolder(ctx, setupInfo, drive, replaceMissingFolders))
		.andThen((client) => linkBookingDriveClient(ctx, setupInfo, client))
		.andThen((client) => allocateSessionFolderNumber(ctx, setupInfo, client))
		.andThen((numbered) =>
			getOrCreateNumberedClientAssetsFolder(ctx, setupInfo, replaceMissingFolders, numbered)
		)
		.andThen((withAssets) =>
			getOrCreateNumberedSessionParentFolder(ctx, setupInfo, replaceMissingFolders, withAssets)
		)
		.andThen((withParent) =>
			getOrCreateNumberedSessionFolder(ctx, setupInfo, replaceMissingFolders, withParent)
		)
		.andThen(({ drive, sessionFolderId }) =>
			getOrCreateChildFolders(ctx, drive, setupInfo, sessionFolderId, replaceMissingFolders)
		)
		.map(() => null);
}
