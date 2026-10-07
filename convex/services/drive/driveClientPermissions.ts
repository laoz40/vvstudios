"use node";

import type { ResultAsync } from "neverthrow";
import { internal } from "#convex/_generated/api";
import type { Id } from "#convex/_generated/dataModel";
import type { ActionCtx } from "#convex/_generated/server";
import {
	loadReadyBookingDriveFolders,
	recordClientDrivePermissionsFailure,
	requireClientDrivePermissions,
	sendClientAssetsFolderEmail,
	type DriveClientPermissionsError
} from "#convex/services/drive/clientDrivePermissions";
import { fromConvexTuple } from "#convex/lib/result";

export function requireClientDrivePermissionsAndSendAssetsEmail(
	ctx: ActionCtx,
	args: { bookingId: Id<"bookings">; attempt: "automatic" | "retry" }
): ResultAsync<null, DriveClientPermissionsError> {
	return loadReadyBookingDriveFolders(ctx, args.bookingId)
		.andThen((setup) => checkAndRecordClientDrivePermissions(ctx, setup))
		.andThen(() => sendClientAssetsFolderEmail(ctx, args.bookingId, args.attempt));
}

function checkAndRecordClientDrivePermissions(
	ctx: ActionCtx,
	setup: Parameters<typeof requireClientDrivePermissions>[1]
) {
	return requireClientDrivePermissions(ctx, setup).orElse((error) =>
		recordClientDrivePermissionsFailure(ctx, setup, error)
	);
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
