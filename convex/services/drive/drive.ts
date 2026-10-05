"use node";

import { errAsync, okAsync, type ResultAsync } from "neverthrow";
import { internal } from "#convex/_generated/api";
import type { Id } from "#convex/_generated/dataModel";
import type { ActionCtx } from "#convex/_generated/server";
import {
	areDriveSetupFoldersSaved,
	shouldRecordDriveSetupFailure,
	validateDriveSetup,
	type DriveSetupInfo,
	type SetupError as LibSetupError
} from "#convex/lib/drive/sessionFolders/driveSetupInfo";
import { ensureSessionDriveFolders } from "#convex/services/drive/ensureSessionDriveFolders";
import { fromConvexTuple } from "#convex/lib/result";
import { requireClientDrivePermissionsAndSendAssetsEmail } from "#convex/services/drive/driveClientPermissions";
import { setupEditorAccess } from "#convex/services/drive/editorDrivePermissions";

export type SetupError = LibSetupError;

type DriveSetupLoadArgs = { bookingId: Id<"bookings">; sessionStartAt?: number; duration?: string };

function validateLoadedDriveSetup(args: DriveSetupLoadArgs) {
	return (setupInfo: DriveSetupInfo | null) =>
		validateDriveSetup(
			setupInfo,
			args.sessionStartAt !== undefined && args.duration !== undefined
				? { sessionStartAt: args.sessionStartAt, duration: args.duration }
				: undefined
		);
}

function loadValidatedSetup(
	ctx: ActionCtx,
	args: DriveSetupLoadArgs
): ResultAsync<DriveSetupInfo, LibSetupError> {
	return fromConvexTuple(
		ctx.runQuery(internal.sessionsDriveInternal.getDriveSetup, { bookingId: args.bookingId })
	).andThen(validateLoadedDriveSetup(args));
}

function saveSetupFailure(ctx: ActionCtx, bookingId: Id<"bookings">, failureCode: string) {
	return fromConvexTuple(
		ctx.runMutation(internal.sessionsDriveInternal.saveDriveSetupResult, { bookingId, failureCode })
	);
}

function ensureDriveFoldersForSetup(
	ctx: ActionCtx,
	args: DriveSetupLoadArgs & { replaceMissingFolders: boolean }
) {
	return (setupInfo: DriveSetupInfo) =>
		ensureSessionDriveFolders(ctx, setupInfo, args.replaceMissingFolders);
}

function requireSavedDriveFolders(setupInfo: DriveSetupInfo) {
	return areDriveSetupFoldersSaved(setupInfo)
		? okAsync(null)
		: errAsync({ reason: "DRIVE_FOLDERS_INCOMPLETE" as const });
}

function saveSuccessfulDriveSetup(ctx: ActionCtx, bookingId: Id<"bookings">) {
	return fromConvexTuple(
		ctx.runMutation(internal.sessionsDriveInternal.saveDriveSetupResult, { bookingId })
	);
}

function sendClientAssetsEmailAfterSetup(ctx: ActionCtx, bookingId: Id<"bookings">) {
	return requireClientDrivePermissionsAndSendAssetsEmail(ctx, {
		bookingId,
		attempt: "automatic"
	}).orElse(() => okAsync(null));
}

function setupEditorAccessAfterClientEmail(ctx: ActionCtx, bookingId: Id<"bookings">) {
	return setupEditorAccess(ctx, { bookingId }).orElse(() => okAsync(null));
}

function recordSetupFailureThenRethrow(ctx: ActionCtx, bookingId: Id<"bookings">) {
	return (setupError: LibSetupError) => {
		if (!shouldRecordDriveSetupFailure(setupError)) return errAsync(setupError);

		return saveSetupFailure(ctx, bookingId, setupError.reason).andThen(
			rethrowSetupError(setupError)
		);
	};
}

function rethrowSetupError(setupError: LibSetupError) {
	return () => errAsync(setupError);
}

function reloadValidatedSetup(ctx: ActionCtx, loadArgs: DriveSetupLoadArgs) {
	return () => loadValidatedSetup(ctx, loadArgs);
}

function runAfterSavedDriveFolders(ctx: ActionCtx, bookingId: Id<"bookings">) {
	return () => saveSuccessfulDriveSetup(ctx, bookingId);
}

function runClientAssetsEmailStep(ctx: ActionCtx, bookingId: Id<"bookings">) {
	return () => sendClientAssetsEmailAfterSetup(ctx, bookingId);
}

function runEditorAccessStep(ctx: ActionCtx, bookingId: Id<"bookings">) {
	return () => setupEditorAccessAfterClientEmail(ctx, bookingId);
}

export function createSessionDriveFoldersAndCompleteSetup(
	ctx: ActionCtx,
	args: {
		bookingId: Id<"bookings">;
		sessionStartAt?: number;
		duration?: string;
		replaceMissingFolders: boolean;
	}
): ResultAsync<null, SetupError> {
	const loadArgs: DriveSetupLoadArgs = {
		bookingId: args.bookingId,
		sessionStartAt: args.sessionStartAt,
		duration: args.duration
	};

	return (
		// Create or recover every folder, then mark the folder setup as complete.
		loadValidatedSetup(ctx, loadArgs)
			.andThen(ensureDriveFoldersForSetup(ctx, args))
			.andThen(reloadValidatedSetup(ctx, loadArgs))
			.andThen(requireSavedDriveFolders)
			.andThen(runAfterSavedDriveFolders(ctx, args.bookingId))
			// Client access and its email fail independently from folder setup.
			.andThen(runClientAssetsEmailStep(ctx, args.bookingId))
			// Editor access also fails independently and has its own admin retry.
			.andThen(runEditorAccessStep(ctx, args.bookingId))
			// Only folder setup errors are saved on the booking here.
			.orElse(recordSetupFailureThenRethrow(ctx, args.bookingId))
	);
}

export function runScheduledSessionDriveFolderSetup(
	ctx: ActionCtx,
	args: { bookingId: Id<"bookings">; sessionStartAt: number; duration: string }
): ResultAsync<null, never> {
	// Scheduled jobs resume partial setup only; admins recreate missing folders from the dialog.
	return createSessionDriveFoldersAndCompleteSetup(ctx, {
		...args,
		replaceMissingFolders: false
	}).orElse(() => okAsync(null));
}
