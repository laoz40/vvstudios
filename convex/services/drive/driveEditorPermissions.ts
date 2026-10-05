"use node";

import { errAsync, okAsync } from "neverthrow";
import type { Id } from "#convex/_generated/dataModel";
import type { ActionCtx } from "#convex/_generated/server";
import {
	loadEditorDriveAccessToRemove,
	markPreviousEditorRemovalFailed,
	removePreviousEditorDriveAccess,
	setupEditorAccessIfAssigned
} from "#convex/lib/drive/driveEditorPermissions";

export type { DriveEditorPermissionsError } from "#convex/lib/drive/driveEditorPermissions";

export function runEditorDriveAccessUpdate(
	ctx: ActionCtx,
	args: { bookingId: Id<"bookings">; previousEditorTokenIdentifier: string }
) {
	return loadEditorDriveAccessToRemove(ctx, {
		bookingId: args.bookingId,
		editorTokenIdentifier: args.previousEditorTokenIdentifier
	}).andThen((access) => {
		const removal =
			access === null
				? okAsync(null)
				: removePreviousEditorDriveAccess(ctx, {
						access,
						previousEditorTokenIdentifier: args.previousEditorTokenIdentifier
					});

		// A removal failure is recorded for manual retry; it never blocks the replacement editor's setup.
		return removal
			.orElse((error) =>
				markPreviousEditorRemovalFailed(ctx, {
					bookingId: args.bookingId,
					editorTokenIdentifier: args.previousEditorTokenIdentifier
				}).andThen(() => errAsync(error))
			)
			.orElse(() => okAsync(null))
			.andThen(() => setupEditorAccessIfAssigned(ctx, { bookingId: args.bookingId }));
	});
}
