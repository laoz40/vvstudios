"use node";

import { okAsync, type ResultAsync } from "neverthrow";
import { internal } from "#convex/_generated/api";
import type { Id } from "#convex/_generated/dataModel";
import type { ActionCtx } from "#convex/_generated/server";
import {
	clearSessionDriveDb,
	deleteEmptyDriveFolderWhenEmpty
} from "#convex/lib/drive/sessionFolders/cancelCleanup";
import { loadDriveClient, type DriveClient } from "#convex/lib/drive/googleDrive";
import { fromConvexTuple } from "#convex/lib/result";
import type { DriveSetupInfo } from "#convex/lib/drive/sessionFolders/driveSetupInfo";

function deleteEmptySessionFolderWhenPossible(
	ctx: ActionCtx,
	bookingId: Id<"bookings">,
	sessionFolderId: string
) {
	return (drive: DriveClient) =>
		deleteEmptyDriveFolderWhenEmpty(ctx, { bookingId, drive, sessionFolderId });
}

function clearCancelledDriveFromSetup(ctx: ActionCtx, bookingId: Id<"bookings">) {
	return (setupInfo: DriveSetupInfo | null) => {
		const sessionFolderId = setupInfo?.driveSession?.sessionFolder?.id;

		if (sessionFolderId === undefined) {
			return clearSessionDriveDb(ctx, bookingId);
		}

		return loadDriveClient()
			.andThen(deleteEmptySessionFolderWhenPossible(ctx, bookingId, sessionFolderId))
			.orElse(() => okAsync(null));
	};
}

export function clearCancelledSessionDriveFields(
	ctx: ActionCtx,
	args: { bookingId: Id<"bookings"> }
): ResultAsync<null, never> {
	return fromConvexTuple(
		ctx.runQuery(internal.sessionsDriveInternal.getDriveSetup, { bookingId: args.bookingId })
	)
		.andThen(clearCancelledDriveFromSetup(ctx, args.bookingId))
		.orElse(() => okAsync(null));
}
