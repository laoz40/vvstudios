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

function removeFailedEditorWhenPresent(ctx: ActionCtx, removal: FailedEditorRemoval | null) {
	if (removal === null) {
		return errAsync({ reason: "PREVIOUS_EDITOR_REMOVAL_NOT_FOUND" as const });
	}

	return removeFailedEditorDriveAccess(ctx, removal);
}

export function retryFailedPreviousEditorRemoval(
	ctx: ActionCtx,
	args: { bookingId: Id<"bookings"> }
) {
	return loadFailedEditorRemoval(ctx, args).andThen((removal: FailedEditorRemoval | null) =>
		removeFailedEditorWhenPresent(ctx, removal)
	);
}

function markPreviousEditorRemovalFailure(
	ctx: ActionCtx,
	bookingId: Id<"bookings">,
	editorTokenIdentifier: string,

	error: DriveEditorPermissionsError
) {
	return markPreviousEditorRemovalFailed(ctx, { bookingId, editorTokenIdentifier }).andThen(() =>
		rethrowDriveEditorError(error)
	);
}

function rethrowDriveEditorError(error: DriveEditorPermissionsError) {
	return errAsync(error);
}

function setupReplacementEditorAccess(ctx: ActionCtx, bookingId: Id<"bookings">) {
	return setupEditorAccessIfAssigned(ctx, { bookingId });
}

function removePreviousEditorThenSetupReplacement(
	ctx: ActionCtx,
	args: { bookingId: Id<"bookings">; previousEditorTokenIdentifier: string },

	access: EditorDriveAccessToRemove | null
) {
	const removal =
		access === null
			? okAsync(null)
			: removePreviousEditorDriveAccess(ctx, {
					access,
					previousEditorTokenIdentifier: args.previousEditorTokenIdentifier
				});

	// A removal failure is recorded for manual retry; it never blocks the replacement editor's setup.
	return removal
		.orElse((error: DriveEditorPermissionsError) =>
			markPreviousEditorRemovalFailure(
				ctx,
				args.bookingId,
				args.previousEditorTokenIdentifier,
				error
			)
		)
		.orElse(() => okAsync(null))
		.andThen(() => setupReplacementEditorAccess(ctx, args.bookingId));
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
