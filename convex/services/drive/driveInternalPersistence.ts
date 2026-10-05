import { errAsync, okAsync, type ResultAsync } from "neverthrow";
import type { Id } from "#convex/_generated/dataModel";
import type { MutationCtx, QueryCtx } from "#convex/_generated/server";
import {
	claimClientAssetsEmail as claimClientAssetsEmailLib,
	saveClientAssetsEmailResult as saveClientAssetsEmailResultLib,
	saveClientDrivePermission as saveClientDrivePermissionLib,
	saveClientDrivePermissionsStatus as saveClientDrivePermissionsStatusLib
} from "#convex/lib/drive/driveClientAccess";
import {
	loadBookingRowForDriveClientSync,
	loadDriveSessionRowByBookingId,
	patchBookingDriveClientId,
	type SyncBookingDriveClientIdFromSessionError
} from "#convex/lib/drive/driveBookingDriveClient";
import {
	clearSavedDriveFolder as clearSavedDriveFolderLib,
	saveDriveClientAssetsFolder as saveDriveClientAssetsFolderLib,
	saveDriveChildFolder as saveDriveChildFolderLib,
	saveDriveClientFolder as saveDriveClientFolderLib,
	saveDrivePackageFolder as saveDrivePackageFolderLib,
	saveDriveSessionFolder as saveDriveSessionFolderLib,
	saveDriveSetupResult as saveDriveSetupResultLib
} from "#convex/lib/drive/driveFolders";
import {
	allocateClientSessionNumber as allocateClientSessionNumberLib,
	allocatePackageSessionNumber as allocatePackageSessionNumberLib
} from "#convex/lib/drive/sessionFolders/allocateNumbers";
import { clearSessionDriveDb as clearSessionDriveDbLib } from "#convex/lib/drive/sessionFolders/clearSessionRecords";
import { getDriveSetup as loadDriveSetupFromLib } from "#convex/lib/drive/driveLookup";
import {
	claimEditorAssignmentEmail as claimEditorAssignmentEmailLib,
	clearPreviousEditorDriveAccess as clearPreviousEditorDriveAccessLib,
	getEditorDriveAccessToRemove as getEditorDriveAccessToRemoveLib,
	getEditorDriveSetup as getEditorDriveSetupLib,
	getFailedEditorRemoval as getFailedEditorRemovalLib,
	markPreviousEditorRemovalFailed as markPreviousEditorRemovalFailedLib,
	saveEditorAssignmentEmailResult as saveEditorAssignmentEmailResultLib,
	saveEditorDrivePermission as saveEditorDrivePermissionLib,
	saveEditorDrivePermissionsStatus as saveEditorDrivePermissionsStatusLib
} from "#convex/lib/drive/driveEditor";

export function getDriveSetup(ctx: QueryCtx, bookingId: Id<"bookings">) {
	return loadDriveSetupFromLib(ctx, bookingId);
}

export function saveDriveClientFolder(
	ctx: MutationCtx,
	args: Parameters<typeof saveDriveClientFolderLib>[1]
) {
	return saveDriveClientFolderLib(ctx, args);
}

export function saveDriveSessionFolder(
	ctx: MutationCtx,
	args: Parameters<typeof saveDriveSessionFolderLib>[1]
) {
	return saveDriveSessionFolderLib(ctx, args);
}

export function syncBookingDriveClientIdFromSession(
	ctx: MutationCtx,
	bookingId: Id<"bookings">
): ResultAsync<null, SyncBookingDriveClientIdFromSessionError> {
	return loadBookingRowForDriveClientSync(ctx, bookingId).andThen((booking) => {
		if (booking === null) {
			return errAsync({ reason: "BOOKING_NOT_FOUND" as const });
		}

		return loadDriveSessionRowByBookingId(ctx, bookingId).andThen((driveSession) => {
			if (driveSession === null) {
				return errAsync({ reason: "DRIVE_RECORD_NOT_FOUND" as const });
			}

			if (booking.driveClientId === driveSession.driveClientId) {
				return okAsync(null);
			}

			return patchBookingDriveClientId(ctx, bookingId, driveSession.driveClientId);
		});
	});
}

export function saveDrivePackageFolder(
	ctx: MutationCtx,
	args: Parameters<typeof saveDrivePackageFolderLib>[1]
) {
	return saveDrivePackageFolderLib(ctx, args);
}

export function allocatePackageSessionNumber(
	ctx: MutationCtx,
	args: Parameters<typeof allocatePackageSessionNumberLib>[1]
) {
	return allocatePackageSessionNumberLib(ctx, args);
}

export function allocateClientSessionNumber(
	ctx: MutationCtx,
	args: Parameters<typeof allocateClientSessionNumberLib>[1]
) {
	return allocateClientSessionNumberLib(ctx, args);
}

export function linkBookingDriveClient(
	ctx: MutationCtx,
	bookingId: Id<"bookings">,
	driveClientId: Id<"driveClients">
): ResultAsync<null, SyncBookingDriveClientIdFromSessionError> {
	return loadBookingRowForDriveClientSync(ctx, bookingId).andThen((booking) => {
		if (booking === null) {
			return errAsync({ reason: "BOOKING_NOT_FOUND" as const });
		}

		if (booking.driveClientId === driveClientId) {
			return okAsync(null);
		}

		return patchBookingDriveClientId(ctx, bookingId, driveClientId);
	});
}

export function saveDriveClientAssetsFolder(
	ctx: MutationCtx,
	args: Parameters<typeof saveDriveClientAssetsFolderLib>[1]
) {
	return saveDriveClientAssetsFolderLib(ctx, args);
}

export function saveDriveSetupResult(
	ctx: MutationCtx,
	args: Parameters<typeof saveDriveSetupResultLib>[1]
) {
	return saveDriveSetupResultLib(ctx, args);
}

export function clearSavedDriveFolder(
	ctx: MutationCtx,
	args: Parameters<typeof clearSavedDriveFolderLib>[1]
) {
	return clearSavedDriveFolderLib(ctx, args);
}

export function saveDriveChildFolder(
	ctx: MutationCtx,
	args: Parameters<typeof saveDriveChildFolderLib>[1]
) {
	return saveDriveChildFolderLib(ctx, args);
}

export function saveClientDrivePermission(
	ctx: MutationCtx,
	args: Parameters<typeof saveClientDrivePermissionLib>[1]
) {
	return saveClientDrivePermissionLib(ctx, args);
}

export function saveClientDrivePermissionsStatus(
	ctx: MutationCtx,
	args: Parameters<typeof saveClientDrivePermissionsStatusLib>[1]
) {
	return saveClientDrivePermissionsStatusLib(ctx, args);
}

export function claimClientAssetsEmail(
	ctx: MutationCtx,
	args: Parameters<typeof claimClientAssetsEmailLib>[1]
) {
	return claimClientAssetsEmailLib(ctx, args);
}

export function saveClientAssetsEmailResult(
	ctx: MutationCtx,
	args: Parameters<typeof saveClientAssetsEmailResultLib>[1]
) {
	return saveClientAssetsEmailResultLib(ctx, args);
}

export function getEditorDriveSetup(ctx: QueryCtx, bookingId: Id<"bookings">) {
	return getEditorDriveSetupLib(ctx, bookingId);
}

export function getEditorDriveAccessToRemove(
	ctx: QueryCtx,
	args: Parameters<typeof getEditorDriveAccessToRemoveLib>[1]
) {
	return getEditorDriveAccessToRemoveLib(ctx, args);
}

export function clearPreviousEditorDriveAccess(
	ctx: MutationCtx,
	args: Parameters<typeof clearPreviousEditorDriveAccessLib>[1]
) {
	return clearPreviousEditorDriveAccessLib(ctx, args);
}

export function markPreviousEditorRemovalFailed(
	ctx: MutationCtx,
	args: Parameters<typeof markPreviousEditorRemovalFailedLib>[1]
) {
	return markPreviousEditorRemovalFailedLib(ctx, args);
}

export function getFailedEditorRemoval(ctx: QueryCtx, bookingId: Id<"bookings">) {
	return getFailedEditorRemovalLib(ctx, bookingId);
}

export function saveEditorDrivePermission(
	ctx: MutationCtx,
	args: Parameters<typeof saveEditorDrivePermissionLib>[1]
) {
	return saveEditorDrivePermissionLib(ctx, args);
}

export function saveEditorDrivePermissionsStatus(
	ctx: MutationCtx,
	args: Parameters<typeof saveEditorDrivePermissionsStatusLib>[1]
) {
	return saveEditorDrivePermissionsStatusLib(ctx, args);
}

export function claimEditorAssignmentEmail(
	ctx: MutationCtx,
	args: Parameters<typeof claimEditorAssignmentEmailLib>[1]
) {
	return claimEditorAssignmentEmailLib(ctx, args);
}

export function saveEditorAssignmentEmailResult(
	ctx: MutationCtx,
	args: Parameters<typeof saveEditorAssignmentEmailResultLib>[1]
) {
	return saveEditorAssignmentEmailResultLib(ctx, args);
}

export function clearSessionDriveDb(
	ctx: MutationCtx,
	args: Parameters<typeof clearSessionDriveDbLib>[1]
) {
	return clearSessionDriveDbLib(ctx, args);
}
