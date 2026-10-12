"use node";

import { ok, okAsync, safeTry, type ResultAsync } from "neverthrow";
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
	// Cleanup is best-effort. Keep records on external failure so admins can retry.
	return safeTry(async function* () {
		const setupInfo = yield* clearCancelledSessionDriveFieldsOperation(ctx, args);
		const folderId = cancelledSessionFolderId(setupInfo);
		const drive = yield* loadDriveClientForCancelledFolder(folderId);
		const shouldClear = yield* cleanDriveFolderTreeIfEmpty(drive, folderId);
		const cleared = yield* clearSessionDriveDbIfRequested(ctx, args.bookingId, shouldClear);

		return ok(cleared);
	}).orElse(() => okAsync(null));
}
