"use node";

import type { ResultAsync } from "neverthrow";
import { internal } from "#convex/_generated/api";
import type { Id } from "#convex/_generated/dataModel";
import type { ActionCtx } from "#convex/_generated/server";
import {
	loadReadyBookingDriveFolders as loadReadyBookingDriveFoldersLib,
	recordClientDrivePermissionsFailure as recordClientDrivePermissionsFailureLib,
	requireClientDrivePermissions as requireClientDrivePermissionsLib,
	sendClientAssetsFolderEmail as sendClientAssetsFolderEmailLib,
	type DriveClientPermissionsError
} from "#convex/lib/drive/driveClientPermissions";
import { fromConvexTuple } from "#convex/lib/result";

export type { DriveClientPermissionsError };

export function loadReadyBookingDriveFolders(
	ctx: ActionCtx,
	bookingId: Parameters<typeof loadReadyBookingDriveFoldersLib>[1]
) {
	return loadReadyBookingDriveFoldersLib(ctx, bookingId);
}

export function recordClientDrivePermissionsFailure(
	ctx: ActionCtx,
	setup: Parameters<typeof recordClientDrivePermissionsFailureLib>[1],
	error: Parameters<typeof recordClientDrivePermissionsFailureLib>[2]
) {
	return recordClientDrivePermissionsFailureLib(ctx, setup, error);
}

export function requireClientDrivePermissions(
	ctx: ActionCtx,
	setup: Parameters<typeof requireClientDrivePermissionsLib>[1]
) {
	return requireClientDrivePermissionsLib(ctx, setup);
}

export function sendClientAssetsFolderEmail(
	ctx: ActionCtx,
	bookingId: Parameters<typeof sendClientAssetsFolderEmailLib>[1],
	attempt: Parameters<typeof sendClientAssetsFolderEmailLib>[2]
) {
	return sendClientAssetsFolderEmailLib(ctx, bookingId, attempt);
}

export function requireClientDrivePermissionsAndSendAssetsEmail(
	ctx: ActionCtx,
	args: { bookingId: Id<"bookings">; attempt: "automatic" | "retry" }
): ResultAsync<null, DriveClientPermissionsError> {
	return loadReadyBookingDriveFolders(ctx, args.bookingId)
		.andThen((setup) =>
			requireClientDrivePermissions(ctx, setup).orElse((error) =>
				recordClientDrivePermissionsFailure(ctx, setup, error)
			)
		)
		.andThen(() => sendClientAssetsFolderEmail(ctx, args.bookingId, args.attempt));
}

export function syncBookingDriveClientIdForRetry(
	ctx: ActionCtx,
	bookingId: Id<"bookings">
): ResultAsync<null, DriveClientPermissionsError> {
	return fromConvexTuple(
		ctx.runMutation(internal.sessionsDriveInternal.syncBookingDriveClientIdFromSession, {
			bookingId
		})
	);
}
