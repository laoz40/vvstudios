"use node";

import { okAsync, type ResultAsync } from "neverthrow";
import type { Id } from "#convex/_generated/dataModel";
import type { ActionCtx } from "#convex/_generated/server";
import {
	clearCancelledSessionDriveFieldsOperation,
	loadDriveClientForCancelledFolder
} from "#convex/drive/lib/cleanupCancelledSessionDriveIo";
import {
	cancelledSessionFolderId,
	clearSessionDriveDbIfRequested
} from "#convex/drive/lib/sessionFolders/cancelCleanup";
import { cleanDriveFolderTreeIfEmpty } from "#convex/drive/services/googleDriveFolderTree";

export function clearCancelledSessionDriveFields(
	ctx: ActionCtx,
	args: { bookingId: Id<"bookings"> }
): ResultAsync<null, never> {
	return (
		clearCancelledSessionDriveFieldsOperation(ctx, args)
			.andThen((setupInfo) => {
				const folderId = cancelledSessionFolderId(setupInfo);

				return loadDriveClientForCancelledFolder(folderId).andThen((drive) =>
					cleanDriveFolderTreeIfEmpty(drive, folderId).andThen((shouldClear) =>
						clearSessionDriveDbIfRequested(ctx, args.bookingId, shouldClear)
					)
				);
			})
			// Cleanup is best-effort. Keep records on external failure so admins can retry.
			.orElse(() => okAsync(null))
	);
}
