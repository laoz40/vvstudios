"use node";

import { internal } from "#convex/_generated/api";
import type { Id } from "#convex/_generated/dataModel";
import type { ActionCtx } from "#convex/_generated/server";
import {
	shouldRecordDriveSetupFailure,
	type SetupError
} from "#convex/drive/lib/sessionFolders/driveSetupInfo";
import type { DriveChildFolderName, SavedDriveFolder } from "#convex/drive/lib/googleDrive";
import { okAsync, type ResultAsync } from "neverthrow";
import { fromConvexTuple } from "#convex/shared/lib/result";

export function getDriveSetupRow(ctx: ActionCtx, bookingId: Id<"bookings">) {
	return fromConvexTuple(ctx.runQuery(internal.sessions.drive.getDriveSetup, { bookingId }));
}

export function saveDriveSetupResultRow(ctx: ActionCtx, args: { bookingId: Id<"bookings"> }) {
	return fromConvexTuple(ctx.runMutation(internal.sessions.drive.saveDriveSetupResult, args));
}

export function saveDriveSetupFailureRow(
	ctx: ActionCtx,
	args: { bookingId: Id<"bookings">; failureCode: string }
) {
	return fromConvexTuple(ctx.runMutation(internal.sessions.drive.saveDriveSetupResult, args));
}

export function saveReportableDriveSetupFailure(
	ctx: ActionCtx,
	bookingId: Id<"bookings">,
	error: SetupError
) {
	if (!shouldRecordDriveSetupFailure(error)) {
		return okAsync(null);
	}

	return saveDriveSetupFailureRow(ctx, { bookingId, failureCode: error.reason });
}

export function linkBookingDriveClientRow(
	ctx: ActionCtx,
	args: { bookingId: Id<"bookings">; driveClientId: Id<"driveClients"> }
) {
	return fromConvexTuple(ctx.runMutation(internal.sessions.drive.linkBookingDriveClient, args));
}

export function clearDriveClientFolderRow(
	ctx: ActionCtx,
	args: { driveClientId: Id<"driveClients"> } | null
) {
	return args === null
		? okAsync(null)
		: fromConvexTuple(ctx.runMutation(internal.sessions.drive.clearDriveClientFolder, args));
}

export function clearDriveClientAssetsFolderRow(
	ctx: ActionCtx,
	args: { driveClientId: Id<"driveClients"> }
) {
	return fromConvexTuple(
		ctx.runMutation(internal.sessions.drive.clearDriveClientAssetsFolder, args)
	);
}

export function clearDrivePackageFolderRow(
	ctx: ActionCtx,
	args: { bookingId: Id<"bookings"> } | null
) {
	return args === null
		? okAsync(null)
		: fromConvexTuple(ctx.runMutation(internal.sessions.drive.clearDrivePackageFolder, args));
}

export function clearDriveSessionFolderRow(ctx: ActionCtx, args: { bookingId: Id<"bookings"> }) {
	return fromConvexTuple(ctx.runMutation(internal.sessions.drive.clearDriveSessionFolder, args));
}

export function clearDriveChildFolderRow(
	ctx: ActionCtx,
	args: { bookingId: Id<"bookings">; name: "Raw Media" | "Deliverables" }
) {
	return fromConvexTuple(ctx.runMutation(internal.sessions.drive.clearDriveChildFolder, args));
}

export function saveDriveSessionFolderRow(
	ctx: ActionCtx,
	args: {
		bookingId: Id<"bookings">;
		driveClientId: Id<"driveClients">;
		folder: SavedDriveFolder;
	} | null
) {
	return args === null
		? okAsync(null)
		: fromConvexTuple(ctx.runMutation(internal.sessions.drive.saveDriveSessionFolder, args));
}

export function saveDriveChildFolderRow(
	ctx: ActionCtx,
	args: { bookingId: Id<"bookings">; name: DriveChildFolderName; folder: SavedDriveFolder } | null
): ResultAsync<Id<"driveSessions"> | null, SetupError> {
	return args === null
		? okAsync(null)
		: fromConvexTuple(ctx.runMutation(internal.sessions.drive.saveDriveChildFolder, args));
}

export function saveDriveClientFolderRow(
	ctx: ActionCtx,
	args: { normalizedEmail: string; displayName: string; folder: SavedDriveFolder }
): ResultAsync<SavedDriveClientFolderRow, SetupError> {
	return fromConvexTuple(ctx.runMutation(internal.sessions.drive.saveDriveClientFolder, args));
}

type SavedDriveClientFolderRow = {
	driveClientId: Id<"driveClients">;
	folderId: string;
	assetsFolder: { id: string; url: string } | undefined;
};

export function saveDriveClientFolderRowIfRequested(
	ctx: ActionCtx,
	args: { normalizedEmail: string; displayName: string; folder: SavedDriveFolder } | null
): ResultAsync<SavedDriveClientFolderRow | null, SetupError> {
	return args === null ? okAsync(null) : saveDriveClientFolderRow(ctx, args);
}

export function saveDriveClientAssetsFolderRow(
	ctx: ActionCtx,
	args: { driveClientId: Id<"driveClients">; folder: SavedDriveFolder }
) {
	return fromConvexTuple(
		ctx.runMutation(internal.sessions.drive.saveDriveClientAssetsFolder, args)
	);
}

export function saveDriveClientAssetsFolderRowIfRequested(
	ctx: ActionCtx,
	args: { driveClientId: Id<"driveClients">; folder: SavedDriveFolder } | null
) {
	return args === null ? okAsync(null) : saveDriveClientAssetsFolderRow(ctx, args);
}

export function allocatePackageSessionNumberRow(
	ctx: ActionCtx,
	args: { bookingId: Id<"bookings"> }
) {
	return fromConvexTuple(
		ctx.runMutation(internal.sessions.drive.allocatePackageSessionNumber, args)
	);
}

export function allocateClientSessionNumberRow(
	ctx: ActionCtx,
	args: { bookingId: Id<"bookings"> }
) {
	return fromConvexTuple(
		ctx.runMutation(internal.sessions.drive.allocateClientSessionNumber, args)
	);
}

export function allocateSessionFolderNumberRow(
	ctx: ActionCtx,
	args: { bookingId: Id<"bookings">; packageBooking: boolean }
) {
	return args.packageBooking
		? allocatePackageSessionNumberRow(ctx, { bookingId: args.bookingId })
		: allocateClientSessionNumberRow(ctx, { bookingId: args.bookingId });
}

export function saveDrivePackageFolderRow(
	ctx: ActionCtx,
	args: { bookingId: Id<"bookings">; folder: SavedDriveFolder } | null
) {
	return args === null
		? okAsync(null)
		: fromConvexTuple(ctx.runMutation(internal.sessions.drive.saveDrivePackageFolder, args));
}
