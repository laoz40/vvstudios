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
		loadValidatedSetup(ctx, args)
			.andThen((setupInfo) => createDriveFolders(ctx, setupInfo))
			.andThen(() =>
				fromConvexTuple(
					ctx.runMutation(internal.sessions.saveDriveSetupResult, { bookingId: args.bookingId })
				)
			)
			// Folder setup remains ready when permissions or email delivery fails.
			.andThen(() =>
				requireClientDrivePermissionsAndSendAssetsEmail(ctx, {
					bookingId: args.bookingId,
					attempt: "automatic"
				}).orElse(() => okAsync(null))
			)
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
				}).orElse(() => okAsync(null))
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
