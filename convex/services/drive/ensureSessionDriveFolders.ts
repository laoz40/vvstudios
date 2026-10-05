"use node";

import type { ResultAsync } from "neverthrow";
import type { ActionCtx } from "#convex/_generated/server";
import type { DriveSetupInfo, SetupError } from "#convex/lib/drive/sessionFolders/driveSetupInfo";
import { loadDriveClient } from "#convex/lib/drive/googleDrive";
import { returnNull } from "#convex/services/drive/ensureSessionDriveFolderHelpers";
import {
	allocateSessionFolderNumberStep,
	getOrCreateChildFoldersStep,
	getOrCreateClientAssetsFolderStep,
	getOrCreateClientFolderStep,
	getOrCreateSessionFolderStep,
	getOrCreateSessionParentFolderStep,
	linkBookingDriveClientStep
} from "#convex/services/drive/ensureSessionDriveFolderSteps";

export function ensureSessionDriveFolders(
	ctx: ActionCtx,
	setupInfo: DriveSetupInfo,
	replaceMissingFolders = false
): ResultAsync<null, SetupError> {
	return loadDriveClient()
		.andThen(getOrCreateClientFolderStep(ctx, setupInfo, replaceMissingFolders))
		.andThen(linkBookingDriveClientStep(ctx, setupInfo))
		.andThen(allocateSessionFolderNumberStep(ctx, setupInfo))
		.andThen(getOrCreateClientAssetsFolderStep(ctx, setupInfo, replaceMissingFolders))
		.andThen(getOrCreateSessionParentFolderStep(ctx, setupInfo, replaceMissingFolders))
		.andThen(getOrCreateSessionFolderStep(ctx, setupInfo, replaceMissingFolders))
		.andThen(getOrCreateChildFoldersStep(ctx, setupInfo, replaceMissingFolders))
		.map(returnNull);
}
