"use node";

import { err, ok, okAsync, safeTry } from "neverthrow";
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
	return safeTry(async function* () {
		const removal = yield* loadFailedEditorRemoval(ctx, args);
		const validRemoval = yield* requireFailedEditorRemoval(args, removal);

		return ok(yield* removeFailedEditorDriveAccess(ctx, validRemoval));
	});
}

function markPreviousEditorRemovalFailure(
	ctx: ActionCtx,
	bookingId: Id<"bookings">,
	editorTokenIdentifier: string,

	error: DriveEditorPermissionsError
) {
	return safeTry(async function* () {
		yield* markPreviousEditorRemovalFailed(ctx, { bookingId, editorTokenIdentifier });

		return err(error);
	});
}

function removePreviousEditorThenSetupReplacement(
	ctx: ActionCtx,
	args: { bookingId: Id<"bookings">; previousEditorTokenIdentifier: string },

	access: EditorDriveAccessToRemove | null
) {
	// A removal failure is recorded for manual retry; it never blocks the replacement editor's setup.
	return safeTry(async function* () {
		yield* removePreviousEditorDriveAccess(ctx, {
			access,
			previousEditorTokenIdentifier: args.previousEditorTokenIdentifier
		})
			.orElse((error) =>
				markPreviousEditorRemovalFailure(
					ctx,
					args.bookingId,
					args.previousEditorTokenIdentifier,
					error
				)
			)
			.orElse(() => okAsync(null));

		return ok(yield* setupEditorAccessIfAssigned(ctx, { bookingId: args.bookingId }));
	});
}

export function runEditorDriveAccessUpdate(
	ctx: ActionCtx,
	args: { bookingId: Id<"bookings">; previousEditorTokenIdentifier: string }
) {
	return safeTry(async function* () {
		const access = yield* loadEditorDriveAccessToRemove(ctx, {
			bookingId: args.bookingId,
			editorTokenIdentifier: args.previousEditorTokenIdentifier
		});

		return ok(yield* removePreviousEditorThenSetupReplacement(ctx, args, access));
	});
}
