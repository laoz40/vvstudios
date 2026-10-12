"use node";

import { ok, safeTry, type ResultAsync } from "neverthrow";
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
	return safeTry(async function* () {
		const drive = yield* loadDriveClient();
		const client = yield* getOrCreateClientFolder(ctx, setupInfo, drive, replaceMissingFolders);
		const linkedClient = yield* linkBookingDriveClient(ctx, setupInfo, client);
		const numbered = yield* allocateSessionFolderNumber(ctx, setupInfo, linkedClient);

		const withAssets = yield* getOrCreateNumberedClientAssetsFolder(
			ctx,
			setupInfo,
			replaceMissingFolders,
			numbered
		);

		const withParent = yield* getOrCreateNumberedSessionParentFolder(
			ctx,
			setupInfo,
			replaceMissingFolders,
			withAssets
		);

		const session = yield* getOrCreateNumberedSessionFolder(
			ctx,
			setupInfo,
			replaceMissingFolders,
			withParent
		);

		yield* getOrCreateChildFolders(
			ctx,
			session.drive,
			setupInfo,
			session.sessionFolderId,
			replaceMissingFolders
		);

		return ok(null);
	});
}
