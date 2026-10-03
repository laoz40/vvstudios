"use node";

import { okAsync, type ResultAsync } from "neverthrow";
import { internal } from "#convex/_generated/api";
import type { Id } from "#convex/_generated/dataModel";
import type { ActionCtx } from "#convex/_generated/server";
import {
	deleteDriveFolderTree,
	isDriveFolderTreeEmpty,
	type DriveClient
} from "#convex/lib/drive/googleDrive";
import { fromConvexTuple } from "#convex/lib/result";

export function clearSessionDriveDb(
	ctx: ActionCtx,
	bookingId: Id<"bookings">
): ResultAsync<null, never> {
	return fromConvexTuple(
		ctx.runMutation(internal.sessions.clearSessionDriveDb, { bookingId })
	).orElse(() => okAsync(null));
}

export function deleteEmptyDriveFolderWhenEmpty(
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
