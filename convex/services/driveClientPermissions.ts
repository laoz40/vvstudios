"use node";

import type { ResultAsync } from "neverthrow";
import { internal } from "#convex/_generated/api";
import type { Id } from "#convex/_generated/dataModel";
import type { ActionCtx } from "#convex/_generated/server";
import { requirePermissionActions } from "#convex/lib/auth";
import {
	loadReadyBookingDriveFolders,
	recordClientDrivePermissionsFailure,
	requireClientDrivePermissions,
	sendClientAssetsFolderEmail,
	type DriveClientPermissionsError
} from "#convex/lib/drive/driveClientPermissions";
import { fromConvexTuple } from "#convex/lib/result";

export type { DriveClientPermissionsError } from "#convex/lib/drive/driveClientPermissions";

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

function syncBookingDriveClientIdForRetry(
	ctx: ActionCtx,
	bookingId: Id<"bookings">
): ResultAsync<null, DriveClientPermissionsError> {
	return fromConvexTuple(
		ctx.runMutation(internal.sessions.syncBookingDriveClientIdFromSession, { bookingId })
	);
}

export function retryClientDrivePermissionsService(
	ctx: ActionCtx,
	args: { bookingId: Id<"bookings"> }
) {
	return requirePermissionActions(ctx, "edit:sessions")
		.andThen(() => loadReadyBookingDriveFolders(ctx, args.bookingId))
		.andThen((setup) =>
			syncBookingDriveClientIdForRetry(ctx, args.bookingId).andThen(() =>
				requireClientDrivePermissions(ctx, setup).orElse((error) =>
					recordClientDrivePermissionsFailure(ctx, setup, error)
				)
			)
		)
		.map(() => null);
}

export function retryClientAssetsEmailService(ctx: ActionCtx, args: { bookingId: Id<"bookings"> }) {
	return requirePermissionActions(ctx, "edit:sessions").andThen(() =>
		sendClientAssetsFolderEmail(ctx, args.bookingId, "retry")
	);
}
