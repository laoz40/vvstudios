"use node";

import { errAsync, type ResultAsync } from "neverthrow";
import { internal } from "#convex/_generated/api";
import type { Id } from "#convex/_generated/dataModel";
import type { ActionCtx } from "#convex/_generated/server";
import { requirePermissionActions } from "#convex/lib/auth";
import {
	loadReadyBookingDriveFolders,
	requireClientDrivePermissions,
	saveClientDrivePermissionsStatus,
	sendClientAssetsFolderEmail,
	type DriveClientPermissionsError
} from "#convex/lib/driveClientPermissions";
import { fromConvexTuple } from "#convex/lib/result";

export type { DriveClientPermissionsError } from "#convex/lib/driveClientPermissions";

export function requireClientDrivePermissionsAndSendAssetsEmail(
	ctx: ActionCtx,
	args: { bookingId: Id<"bookings">; attempt: "automatic" | "retry" }
): ResultAsync<null, DriveClientPermissionsError> {
	return loadReadyBookingDriveFolders(ctx, args.bookingId)
		.andThen((setup) =>
			requireClientDrivePermissions(ctx, setup).orElse((error) =>
				saveClientDrivePermissionsStatus(ctx, setup.booking._id, "failed").andThen(() =>
					errAsync(error)
				)
			)
		)
		.andThen(() => sendClientAssetsFolderEmail(ctx, args.bookingId, args.attempt));
}

function backfillBookingDriveClientIdForRetry(
	ctx: ActionCtx,
	bookingId: Id<"bookings">
): ResultAsync<null, DriveClientPermissionsError> {
	return fromConvexTuple(
		ctx.runMutation(internal.sessions.backfillBookingDriveClientId, { bookingId })
	).mapErr((error) => {
		switch (error.reason) {
			case "BOOKING_NOT_FOUND":
				return { reason: "BOOKING_NOT_FOUND" as const };
			case "DRIVE_RECORD_NOT_FOUND":
				return { reason: "DRIVE_FOLDERS_NOT_READY" as const };
			default:
				return { reason: "DRIVE_CLIENT_PERMISSIONS_SAVE_FAILED" as const };
		}
	});
}

export function retryClientDrivePermissionsService(
	ctx: ActionCtx,
	args: { bookingId: Id<"bookings"> }
) {
	return requirePermissionActions(ctx, "edit:sessions")
		.andThen(() => loadReadyBookingDriveFolders(ctx, args.bookingId))
		.andThen((setup) =>
			backfillBookingDriveClientIdForRetry(ctx, args.bookingId).andThen(() =>
				requireClientDrivePermissions(ctx, setup).orElse((error) =>
					saveClientDrivePermissionsStatus(ctx, setup.booking._id, "failed").andThen(() =>
						errAsync(error)
					)
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
