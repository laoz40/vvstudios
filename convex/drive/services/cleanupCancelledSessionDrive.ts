"use node";

import { okAsync, type ResultAsync } from "neverthrow";
import { internal } from "#convex/_generated/api";
import type { Id } from "#convex/_generated/dataModel";
import type { ActionCtx } from "#convex/_generated/server";
import { clearSessionDriveDb } from "#convex/drive/lib/sessionFolders/cancelCleanup";
import { loadDriveClient, type DriveClient } from "#convex/drive/lib/googleDrive";
import { fromConvexTuple } from "#convex/shared/lib/result";
import type { DriveSetupInfo } from "#convex/drive/lib/sessionFolders/driveSetupInfo";
import {
	deleteDriveFolderTree,
	isDriveFolderTreeEmpty
} from "#convex/drive/services/googleDriveFolderTree";

function deleteEmptySessionFolder(
	ctx: ActionCtx,
	bookingId: Id<"bookings">,
	drive: DriveClient,
	sessionFolderId: string
) {
	return isDriveFolderTreeEmpty(drive, sessionFolderId).andThen((isEmpty) =>
		deleteSessionFolderIfEmpty(ctx, bookingId, drive, sessionFolderId, isEmpty)
	);
}

function deleteSessionFolderIfEmpty(
	ctx: ActionCtx,
	bookingId: Id<"bookings">,
	drive: DriveClient,
	sessionFolderId: string,
	isEmpty: boolean
) {
	// Never remove a session tree that contains uploaded media.
	if (!isEmpty) return okAsync(null);

	return deleteDriveFolderTree(drive, sessionFolderId).andThen(() =>
		clearSessionDriveDb(ctx, bookingId)
	);
}

function clearCancelledDriveFromSetup(
	ctx: ActionCtx,
	bookingId: Id<"bookings">,
	setupInfo: DriveSetupInfo | null
) {
	const sessionFolderId = setupInfo?.driveSession?.sessionFolder?.id;

	if (sessionFolderId === undefined) {
		return clearSessionDriveDb(ctx, bookingId);
	}

	return loadDriveClient().andThen((drive: DriveClient) =>
		deleteEmptySessionFolder(ctx, bookingId, drive, sessionFolderId)
	);
}

export function clearCancelledSessionDriveFields(
	ctx: ActionCtx,
	args: { bookingId: Id<"bookings"> }
): ResultAsync<null, never> {
	return (
		fromConvexTuple(
			ctx.runQuery(internal.sessions.drive.getDriveSetup, { bookingId: args.bookingId })
		)
			.andThen((setupInfo: DriveSetupInfo | null) =>
				clearCancelledDriveFromSetup(ctx, args.bookingId, setupInfo)
			)
			// Cleanup is best-effort. Keep records on external failure so admins can retry.
			.orElse(() => okAsync(null))
	);
}
