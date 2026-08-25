"use node";

import { errAsync, okAsync, type ResultAsync } from "neverthrow";
import { internal } from "#convex/_generated/api";
import type { Id } from "#convex/_generated/dataModel";
import type { ActionCtx } from "#convex/_generated/server";
import { requirePermissionActions } from "#convex/lib/auth";
import {
	createDriveFolders,
	shouldRecordDriveSetupFailure,
	validateDriveSetup,
	type DriveSetupInfo,
	type SetupError
} from "#convex/lib/driveSetup";
import { fromConvexTuple } from "#convex/lib/result";
import { requireClientDrivePermissionsAndSendAssetsEmail } from "#convex/services/driveClientPermissions";
import { setupEditorAccess } from "#convex/lib/driveEditorPermissions";

export type { SetupError } from "#convex/lib/driveSetup";

function loadValidatedSetup(
	ctx: ActionCtx,
	args: { bookingId: Id<"bookings">; sessionStartAt?: number; duration?: string }
): ResultAsync<DriveSetupInfo, SetupError> {
	return fromConvexTuple(
		ctx.runQuery(internal.sessions.getDriveSetup, { bookingId: args.bookingId })
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
		ctx.runMutation(internal.sessions.saveDriveSetupResult, { bookingId, failureCode })
	);
}

function setupFoldersAndRecordResult(
	ctx: ActionCtx,
	args: { bookingId: Id<"bookings">; sessionStartAt?: number; duration?: string }
): ResultAsync<null, SetupError> {
	return (
		// Create or recover every folder, then mark the folder setup as complete.
		loadValidatedSetup(ctx, args)
			.andThen((setupInfo) => createDriveFolders(ctx, setupInfo))
			.andThen(() =>
				fromConvexTuple(
					ctx.runMutation(internal.sessions.saveDriveSetupResult, { bookingId: args.bookingId })
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

export function setupDriveService(ctx: ActionCtx, args: { bookingId: Id<"bookings"> }) {
	return requirePermissionActions(ctx, "edit:sessions")
		.andThen(() => loadValidatedSetup(ctx, args))
		.andThen((setupInfo) => {
			if (setupInfo.driveSession !== null) {
				return errAsync({ reason: "DRIVE_FOLDERS_ALREADY_CREATED" as const });
			}
			return createDriveFolders(ctx, setupInfo).andThen(() =>
				requireClientDrivePermissionsAndSendAssetsEmail(ctx, {
					bookingId: args.bookingId,
					attempt: "automatic"
				})
					.orElse(() => okAsync(null))
					.andThen(() =>
						setupEditorAccess(ctx, { bookingId: args.bookingId }).orElse(() => okAsync(null))
					)
			);
		});
}

export function retryDriveSetupService(ctx: ActionCtx, args: { bookingId: Id<"bookings"> }) {
	return requirePermissionActions(ctx, "edit:sessions").andThen(() =>
		setupFoldersAndRecordResult(ctx, args)
	);
}

export function runScheduledDriveSetupService(
	ctx: ActionCtx,
	args: { bookingId: Id<"bookings">; sessionStartAt: number; duration: string }
): ResultAsync<null, never> {
	// The admin retries provider failures from the session dialog.
	return setupFoldersAndRecordResult(ctx, args).orElse(() => okAsync(null));
}
