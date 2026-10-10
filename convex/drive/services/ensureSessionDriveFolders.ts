"use node";

import type { ResultAsync } from "neverthrow";
import type { ActionCtx } from "#convex/_generated/server";
import type { DriveSetupInfo, SetupError } from "#convex/drive/lib/sessionFolders/driveSetupInfo";
import { loadDriveClient } from "#convex/drive/lib/googleDrive";
import { returnNull } from "#convex/drive/services/ensureSessionDriveFolderHelpers";
import {
	allocateSessionFolderNumberStep,
	getOrCreateChildFoldersStep,
	getOrCreateClientAssetsFolderStep,
	getOrCreateClientFolderStep,
	getOrCreateSessionFolderStep,
	getOrCreateSessionParentFolderStep,
	linkBookingDriveClientStep
} from "#convex/drive/services/ensureSessionDriveFolderSteps";

export function ensureSessionDriveFolders(
	ctx: ActionCtx,
	setupInfo: DriveSetupInfo,
	replaceMissingFolders = false
): ResultAsync<null, SetupError> {
	return loadDriveClient()
		.andThen((drive) => getOrCreateClientFolderStep(ctx, setupInfo, replaceMissingFolders, drive))
		.andThen((client) => linkBookingDriveClientStep(ctx, setupInfo, client))
		.andThen((client) => allocateSessionFolderNumberStep(ctx, setupInfo, client))
		.andThen((numbered) =>
			getOrCreateClientAssetsFolderStep(ctx, setupInfo, replaceMissingFolders, numbered)
		)
		.andThen((withAssets) =>
			getOrCreateSessionParentFolderStep(ctx, setupInfo, replaceMissingFolders, withAssets)
		)
		.andThen((withParent) =>
			getOrCreateSessionFolderStep(ctx, setupInfo, replaceMissingFolders, withParent)
		)
		.andThen((sessionFolder) =>
			getOrCreateChildFoldersStep(ctx, setupInfo, replaceMissingFolders, sessionFolder)
		)
		.map(returnNull);
}
