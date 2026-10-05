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
} from "#convex/lib/drive/driveClientPermissions";
import { fromConvexTuple } from "#convex/lib/result";

export type { DriveClientPermissionsError } from "#convex/lib/drive/driveClientPermissions";

export {
	loadReadyBookingDriveFolders,
	recordClientDrivePermissionsFailure,
	requireClientDrivePermissions,
	sendClientAssetsFolderEmail
} from "#convex/lib/drive/driveClientPermissions";

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
		ctx.runMutation(internal.internal.sessionsDrive.syncBookingDriveClientIdFromSession, {
			bookingId
		})
	);
}
