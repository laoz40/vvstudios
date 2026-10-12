"use node";

import { syncBookingDriveClientIdForRetryOperation } from "#convex/drive/lib/driveClientPermissionsIo";

import type { ResultAsync } from "neverthrow";
import { ok, safeTry } from "neverthrow";

import type { Id } from "#convex/_generated/dataModel";
import type { ActionCtx } from "#convex/_generated/server";

import {
	loadReadyBookingDriveFolders,
	recordClientDrivePermissionsFailure,
	requireClientDrivePermissions,
	sendClientAssetsFolderEmail,
	type DriveClientPermissionsError
} from "#convex/drive/services/clientDrivePermissions";

export function requireClientDrivePermissionsAndSendAssetsEmail(
	ctx: ActionCtx,
	args: { bookingId: Id<"bookings">; attempt: "automatic" | "retry" }
): ResultAsync<null, DriveClientPermissionsError> {
	return safeTry(async function* () {
		const setup = yield* loadReadyBookingDriveFolders(ctx, args.bookingId);
		yield* checkAndRecordClientDrivePermissions(ctx, setup);
		const email = yield* sendClientAssetsFolderEmail(ctx, args.bookingId, args.attempt);

		return ok(email);
	});
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
	return syncBookingDriveClientIdForRetryOperation(ctx, bookingId);
}
