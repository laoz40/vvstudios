"use node";

import { internal } from "#convex/_generated/api";
import { okAsync, type ResultAsync } from "neverthrow";
import type { Id } from "#convex/_generated/dataModel";
import type { ActionCtx } from "#convex/_generated/server";
import { loadDriveClient, type DriveClient, type DriveError } from "#convex/drive/lib/googleDrive";

import { fromConvexTuple } from "#convex/shared/lib/result";

export function clearCancelledSessionDriveFieldsOperation(
	ctx: ActionCtx,
	args: { bookingId: Id<"bookings"> }
) {
	return fromConvexTuple(
		ctx.runQuery(internal.sessions.drive.getDriveSetup, { bookingId: args.bookingId })
	);
}

export function loadDriveClientForCancelledFolder(
	folderId: string | null
): ResultAsync<DriveClient | null, DriveError> {
	return folderId === null ? okAsync(null) : loadDriveClient();
}
