"use node";

import { okAsync, type ResultAsync } from "neverthrow";
import { internal } from "#convex/_generated/api";
import type { Id } from "#convex/_generated/dataModel";
import type { ActionCtx } from "#convex/_generated/server";
import {
	clearSessionDriveDb,
	deleteEmptyDriveFolderWhenEmpty
} from "#convex/lib/drive/sessionFolders/cancelCleanup";
import { loadDriveClient } from "#convex/lib/drive/googleDrive";
import { fromConvexTuple } from "#convex/lib/result";

export function clearCancelledSessionDriveFields(
	ctx: ActionCtx,
	args: { bookingId: Id<"bookings"> }
): ResultAsync<null, never> {
	return fromConvexTuple(
		ctx.runQuery(internal.internal.sessionsDrive.getDriveSetup, { bookingId: args.bookingId })
	)
		.andThen((setupInfo) => {
			const sessionFolderId = setupInfo?.driveSession?.sessionFolder?.id;

			if (sessionFolderId === undefined) {
				return clearSessionDriveDb(ctx, args.bookingId);
			}

			return loadDriveClient()
				.andThen((drive) =>
					deleteEmptyDriveFolderWhenEmpty(ctx, {
						bookingId: args.bookingId,
						drive,
						sessionFolderId
					})
				)
				.orElse(() => okAsync(null));
		})
		.orElse(() => okAsync(null));
}
