"use node";

import { err, errAsync, ok, okAsync, type ResultAsync } from "neverthrow";
import { internal } from "#convex/_generated/api";
import type { Id } from "#convex/_generated/dataModel";
import type { ActionCtx } from "#convex/_generated/server";
import {
	areDriveSetupFoldersSaved,
	shouldRecordDriveSetupFailure,
	validateDriveSetup,
	type DriveSetupInfo,
	type SetupError as LibSetupError
} from "#convex/drive/lib/sessionFolders/driveSetupInfo";
import { fromConvexTuple } from "#convex/shared/lib/result";
import { requireClientDrivePermissionsAndSendAssetsEmail } from "#convex/drive/services/driveClientPermissions";
import { setupEditorAccess } from "#convex/drive/services/editorDrivePermissions";

export type SetupError = LibSetupError;

type DriveSetupLoadArgs = { bookingId: Id<"bookings">; sessionStartAt?: number; duration?: string };

export function loadValidatedDriveSetup(
	ctx: ActionCtx,
	args: DriveSetupLoadArgs
): ResultAsync<DriveSetupInfo, SetupError> {
	return fromConvexTuple(
		ctx.runQuery(internal.sessions.driveInternal.getDriveSetup, { bookingId: args.bookingId })
	).andThen((setupInfo: DriveSetupInfo | null) =>
		validateDriveSetup(setupInfo, { sessionStartAt: args.sessionStartAt, duration: args.duration })
	);
}

function requireSavedDriveFolders(setupInfo: DriveSetupInfo) {
	return areDriveSetupFoldersSaved(setupInfo)
		? ok(null)
		: err({ reason: "DRIVE_FOLDERS_INCOMPLETE" as const });
}

export function markDriveSetupSuccessful(
	ctx: ActionCtx,
	args: DriveSetupLoadArgs
): ResultAsync<null, SetupError> {
	// Re-read saved folders and timing before marking setup complete.
	return loadValidatedDriveSetup(ctx, args)
		.andThen(requireSavedDriveFolders)
		.andThen(() =>
			fromConvexTuple(
				ctx.runMutation(internal.sessions.driveInternal.saveDriveSetupResult, { bookingId: args.bookingId })
			)
		);
}

export function sendClientAssetsEmailAfterSetup(
	ctx: ActionCtx,
	bookingId: Id<"bookings">
): ResultAsync<null, never> {
	// Access/email failures have their own statuses and must not fail folder setup.
	return requireClientDrivePermissionsAndSendAssetsEmail(ctx, {
		bookingId,
		attempt: "automatic"
	}).orElse(() => okAsync(null));
}

export function setupEditorAccessAfterSetup(
	ctx: ActionCtx,
	bookingId: Id<"bookings">
): ResultAsync<null, never> {
	return setupEditorAccess(ctx, { bookingId }).orElse(() => okAsync(null));
}

export function recordDriveSetupFailure(
	ctx: ActionCtx,
	bookingId: Id<"bookings">,
	setupError: SetupError
): ResultAsync<null, SetupError> {
	if (!shouldRecordDriveSetupFailure(setupError)) return errAsync(setupError);

	return fromConvexTuple(
		ctx.runMutation(internal.sessions.driveInternal.saveDriveSetupResult, {
			bookingId,
			failureCode: setupError.reason
		})
	).andThen(() => errAsync(setupError));
}
