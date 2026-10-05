"use node";

import { errAsync, okAsync } from "neverthrow";
import type { Id } from "#convex/_generated/dataModel";
import type { ActionCtx } from "#convex/_generated/server";
import {
	loadEditorDriveAccessToRemove,
	loadFailedEditorRemoval,
	markPreviousEditorRemovalFailed,
	removeFailedEditorDriveAccess,
	removePreviousEditorDriveAccess,
	sendEditorAssignmentEmailForReadyAccess,
	setupEditorAccess,
	setupEditorAccessIfAssigned,
	type DriveEditorPermissionsError
} from "#convex/services/drive/editorDrivePermissions";

export type { DriveEditorPermissionsError };

export function runEditorAccessSetup(
	ctx: ActionCtx,
	args: Parameters<typeof setupEditorAccess>[1]
) {
	return setupEditorAccess(ctx, args);
}

export function runEditorAssignmentEmailRetry(
	ctx: ActionCtx,
	args: Parameters<typeof sendEditorAssignmentEmailForReadyAccess>[1]
) {
	return sendEditorAssignmentEmailForReadyAccess(ctx, args);
}

export function retryFailedPreviousEditorRemoval(
	ctx: ActionCtx,
	args: { bookingId: Id<"bookings"> }
) {
	return loadFailedEditorRemoval(ctx, args).andThen((removal) => {
		if (removal === null) {
			return errAsync({ reason: "PREVIOUS_EDITOR_REMOVAL_NOT_FOUND" as const });
		}

		return removeFailedEditorDriveAccess(ctx, removal);
	});
}

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
