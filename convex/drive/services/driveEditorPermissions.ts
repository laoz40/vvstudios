"use node";

import { errAsync, okAsync } from "neverthrow";
import type { Id } from "#convex/_generated/dataModel";
import type { ActionCtx } from "#convex/_generated/server";
import type { EditorDriveAccessToRemove } from "#convex/drive/lib/driveEditor";
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
} from "#convex/drive/services/editorDrivePermissions";
import type { FailedEditorRemoval } from "#convex/drive/lib/driveEditor";
import { requireFailedEditorRemoval } from "#convex/drive/lib/editorDrivePermissionsSteps";

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
	args: { bookingId: Id<"bookings"> } | null
) {
	return loadFailedEditorRemoval(ctx, args)
		.andThen((removal: FailedEditorRemoval | null) => requireFailedEditorRemoval(args, removal))
		.andThen((removal) => removeFailedEditorDriveAccess(ctx, removal));
}

function markPreviousEditorRemovalFailure(
	ctx: ActionCtx,
	bookingId: Id<"bookings">,
	editorTokenIdentifier: string,

	error: DriveEditorPermissionsError
) {
	return markPreviousEditorRemovalFailed(ctx, { bookingId, editorTokenIdentifier }).andThen(() =>
		errAsync(error)
	);
}

function removePreviousEditorThenSetupReplacement(
	ctx: ActionCtx,
	args: { bookingId: Id<"bookings">; previousEditorTokenIdentifier: string },

	access: EditorDriveAccessToRemove | null
) {
	// A removal failure is recorded for manual retry; it never blocks the replacement editor's setup.
	return removePreviousEditorDriveAccess(ctx, {
		access,
		previousEditorTokenIdentifier: args.previousEditorTokenIdentifier
	})
		.orElse((error: DriveEditorPermissionsError) =>
			markPreviousEditorRemovalFailure(
				ctx,
				args.bookingId,
				args.previousEditorTokenIdentifier,
				error
			)
		)
		.orElse(() => okAsync(null))
		.andThen(() => setupEditorAccessIfAssigned(ctx, { bookingId: args.bookingId }));
}

export function runEditorDriveAccessUpdate(
	ctx: ActionCtx,
	args: { bookingId: Id<"bookings">; previousEditorTokenIdentifier: string }
) {
	return loadEditorDriveAccessToRemove(ctx, {
		bookingId: args.bookingId,
		editorTokenIdentifier: args.previousEditorTokenIdentifier
	}).andThen((access: EditorDriveAccessToRemove | null) =>
		removePreviousEditorThenSetupReplacement(ctx, args, access)
	);
}
