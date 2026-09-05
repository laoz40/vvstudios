"use node";

import { errAsync, type ResultAsync } from "neverthrow";
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

export function retryClientDrivePermissionsService(
	ctx: ActionCtx,
	args: { bookingId: Id<"bookings"> }
) {
	return requirePermissionActions(ctx, "edit:sessions").andThen(() =>
		requireClientDrivePermissionsAndSendAssetsEmail(ctx, {
			bookingId: args.bookingId,
			attempt: "retry"
		})
	);
}
