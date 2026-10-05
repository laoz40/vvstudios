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
import { ensureSessionDriveFolders } from "#convex/lib/drive/sessionFolders/ensureFolders";
import { fromConvexTuple } from "#convex/lib/result";
import { requireClientDrivePermissionsAndSendAssetsEmail } from "#convex/services/drive/driveClientPermissions";
import { setupEditorAccess } from "#convex/services/drive/editorDrivePermissions";

export type SetupError = LibSetupError;

function loadValidatedSetup(
	ctx: ActionCtx,
	args: { bookingId: Id<"bookings">; sessionStartAt?: number; duration?: string }
): ResultAsync<DriveSetupInfo, LibSetupError> {
	return fromConvexTuple(
		ctx.runQuery(internal.sessionsDriveInternal.getDriveSetup, { bookingId: args.bookingId })
	).andThen((setupInfo) =>
		validateDriveSetup(
			setupInfo,
			args.sessionStartAt !== undefined && args.duration !== undefined
				? { sessionStartAt: args.sessionStartAt, duration: args.duration }
				: undefined
		)
	);
}

function saveSetupFailure(ctx: ActionCtx, bookingId: Id<"bookings">, failureCode: string) {
	return fromConvexTuple(
		ctx.runMutation(internal.sessionsDriveInternal.saveDriveSetupResult, { bookingId, failureCode })
	);
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
	return (
		// Create or recover every folder, then mark the folder setup as complete.
		loadValidatedSetup(ctx, args)
			.andThen((setupInfo) => ensureSessionDriveFolders(ctx, setupInfo, args.replaceMissingFolders))
			.andThen(() => loadValidatedSetup(ctx, args))
			.andThen((setupInfo) =>
				areDriveSetupFoldersSaved(setupInfo)
					? okAsync(null)
					: errAsync({ reason: "DRIVE_FOLDERS_INCOMPLETE" as const })
			)
			.andThen(() =>
				fromConvexTuple(
					ctx.runMutation(internal.sessionsDriveInternal.saveDriveSetupResult, {
						bookingId: args.bookingId
					})
				)
			)
			// Client access and its email fail independently from folder setup.
			.andThen(() =>
				requireClientDrivePermissionsAndSendAssetsEmail(ctx, {
					bookingId: args.bookingId,
					attempt: "automatic"
				}).orElse(() => okAsync(null))
			)
			// Editor access also fails independently and has its own admin retry.
			.andThen(() =>
				setupEditorAccess(ctx, { bookingId: args.bookingId }).orElse(() => okAsync(null))
			)
			// Only folder setup errors are saved on the booking here.
			.orElse((setupError) => {
				if (!shouldRecordDriveSetupFailure(setupError)) return errAsync(setupError);

				return saveSetupFailure(ctx, args.bookingId, setupError.reason).andThen(() =>
					errAsync(setupError)
				);
			})
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
