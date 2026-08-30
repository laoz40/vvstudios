"use node";

import { errAsync, okAsync } from "neverthrow";
import type { Id } from "#convex/_generated/dataModel";
import type { ActionCtx } from "#convex/_generated/server";
import { requirePermissionActions } from "#convex/lib/auth";
import {
	loadEditorDriveAccessToRemove,
	loadFailedEditorRemoval,
	markPreviousEditorRemovalFailed,
	removeFailedEditorDriveAccess,
	removePreviousEditorDriveAccess,
	sendEditorAssignmentEmailForReadyAccess,
	setupEditorAccess
} from "#convex/lib/driveEditorPermissions";

export type { DriveEditorPermissionsError } from "#convex/lib/driveEditorPermissions";

export function retryEditorAccessService(ctx: ActionCtx, args: { bookingId: Id<"bookings"> }) {
	return requirePermissionActions(ctx, "edit:sessions").andThen(() => setupEditorAccess(ctx, args));
}

export function retryEditorAssignmentEmailService(
	ctx: ActionCtx,
	args: { bookingId: Id<"bookings"> }
) {
	return requirePermissionActions(ctx, "edit:sessions").andThen(() =>
		sendEditorAssignmentEmailForReadyAccess(ctx, args)
	);
}

export function runEditorAccessSetupService(ctx: ActionCtx, args: { bookingId: Id<"bookings"> }) {
	return setupEditorAccess(ctx, args).orElse(() => okAsync(null));
}

export function runEditorDriveAccessUpdateService(
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
			.andThen(() => setupEditorAccess(ctx, { bookingId: args.bookingId }));
	});
}

export function retryPreviousEditorRemovalService(
	ctx: ActionCtx,
	args: { bookingId: Id<"bookings"> }
) {
	return requirePermissionActions(ctx, "edit:sessions").andThen(() =>
		loadFailedEditorRemoval(ctx, args).andThen((removal) => {
			if (removal === null) {
				return errAsync({ reason: "PREVIOUS_EDITOR_REMOVAL_NOT_FOUND" as const });
			}
			return removeFailedEditorDriveAccess(ctx, removal);
		})
	);
}
