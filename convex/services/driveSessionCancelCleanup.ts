"use node";

import { okAsync, type ResultAsync } from "neverthrow";
import { internal } from "#convex/_generated/api";
import type { Id } from "#convex/_generated/dataModel";
import type { ActionCtx } from "#convex/_generated/server";
import {
	deleteDriveFolderTree,
	isDriveFolderTreeEmpty,
	loadDriveClient,
	type DriveClient
} from "#convex/lib/googleDrive";
import { fromConvexTuple } from "#convex/lib/result";

// Convex: folder refs + session numbers on driveSessions.
function clearSessionDriveDb(ctx: ActionCtx, bookingId: Id<"bookings">): ResultAsync<null, never> {
	return fromConvexTuple(
		ctx.runMutation(internal.sessions.clearSessionDriveDb, { bookingId })
	).orElse(() => okAsync(null));
}

// Google Drive: delete session folder tree when empty, then clearSessionDriveDb.
function deleteEmptyDriveFolder(
	ctx: ActionCtx,
	args: { bookingId: Id<"bookings">; drive: DriveClient; sessionFolderId: string }
): ResultAsync<null, never> {
	return isDriveFolderTreeEmpty(args.drive, args.sessionFolderId)
		.andThen((isEmpty) => {
			if (!isEmpty) return okAsync(null);

			return deleteDriveFolderTree(args.drive, args.sessionFolderId).andThen(() =>
				clearSessionDriveDb(ctx, args.bookingId)
			);
		})
		.orElse(() => okAsync(null));
}

// Best-effort: cancellation already succeeded; Drive cleanup must not throw back to callers.
export function cleanupCancelledSessionDriveService(
	ctx: ActionCtx,
	args: { bookingId: Id<"bookings"> }
): ResultAsync<null, never> {
	return fromConvexTuple(
		ctx.runQuery(internal.sessions.getDriveSetup, { bookingId: args.bookingId })
	)
		.andThen((setupInfo) => {
			const sessionFolderId = setupInfo?.driveSession?.sessionFolder?.id;

			if (sessionFolderId === undefined) {
				return clearSessionDriveDb(ctx, args.bookingId);
			}

			return loadDriveClient()
				.andThen((drive) =>
					deleteEmptyDriveFolder(ctx, { bookingId: args.bookingId, drive, sessionFolderId })
				)
				.orElse(() => okAsync(null));
		})
		.orElse(() => okAsync(null));
}
