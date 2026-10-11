"use node";

import { errAsync, okAsync, type ResultAsync } from "neverthrow";
import type { Id } from "#convex/_generated/dataModel";
import type { ActionCtx } from "#convex/_generated/server";
import {
	getDriveSetupRow,
	saveReportableDriveSetupFailure,
	saveDriveSetupResultRow
} from "#convex/drive/lib/driveFolderMutations";
import {
	validateDriveSetup,
	validateSavedDriveSetupFolders,
	type DriveSetupInfo,
	type SetupError as LibSetupError
} from "#convex/drive/lib/sessionFolders/driveSetupInfo";
import { requireClientDrivePermissionsAndSendAssetsEmail } from "#convex/drive/services/driveClientPermissions";
import { setupEditorAccess } from "#convex/drive/services/editorDrivePermissions";

export type SetupError = LibSetupError;

type DriveSetupLoadArgs = { bookingId: Id<"bookings">; sessionStartAt?: number; duration?: string };

export function loadValidatedDriveSetup(
	ctx: ActionCtx,
	args: DriveSetupLoadArgs
): ResultAsync<DriveSetupInfo, SetupError> {
	return getDriveSetupRow(ctx, args.bookingId).andThen((setupInfo) =>
		validateDriveSetup(setupInfo, { sessionStartAt: args.sessionStartAt, duration: args.duration })
	);
}

export function markDriveSetupSuccessful(
	ctx: ActionCtx,
	args: DriveSetupLoadArgs
): ResultAsync<null, SetupError> {
	// Re-read saved folders and timing before marking setup complete.
	return loadValidatedDriveSetup(ctx, args)
		.andThen(validateSavedDriveSetupFolders)
		.andThen(() => saveDriveSetupResultRow(ctx, { bookingId: args.bookingId }));
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
	return saveReportableDriveSetupFailure(ctx, bookingId, setupError).andThen(() =>
		errAsync(setupError)
	);
}
