import { err, errAsync, okAsync } from "neverthrow";
import type { Id } from "#convex/_generated/dataModel";
import type { MutationCtx, QueryCtx } from "#convex/_generated/server";
import { bookingRequiresClientAssetsEmail } from "#convex/lib/booking/bookingAddonQuantities";
import {
	claimClientAssetsEmailForSendable,
	saveClientAssetsEmailResult as saveClientAssetsEmailResultLib,
	writeClientDrivePermissionForClient,
	writeClientDrivePermissionsStatusForSession
} from "#convex/lib/drive/driveClientAccess";
import {
	loadBookingRow,
	loadBookingRowForDriveClientSync,
	loadClientAssetsEmailRows,
	loadDriveClientRow,
	loadDriveSessionRowByBookingId,
	patchBookingDriveClientId
} from "#convex/lib/drive/driveBookingDriveClient";
import {
	claimEditorAssignmentEmailForSetup,
	clearPreviousEditorDriveAccess as clearPreviousEditorDriveAccessLib,
	getEditorDriveAccessToRemove as getEditorDriveAccessToRemoveLib,
	getFailedEditorRemoval as getFailedEditorRemovalLib,
	loadEditorDriveSetup,
	markPreviousEditorRemovalFailed as markPreviousEditorRemovalFailedLib,
	saveEditorAssignmentEmailResult as saveEditorAssignmentEmailResultLib,
	writeEditorDrivePermissionForSetup,
	writeEditorDrivePermissionsStatusForSetup
} from "#convex/lib/drive/driveEditor";
import {
	clearSavedDriveFolder as clearSavedDriveFolderLib,
	saveDriveChildFolder as saveDriveChildFolderLib,
	saveDriveClientAssetsFolder as saveDriveClientAssetsFolderLib,
	saveDriveClientFolder as saveDriveClientFolderLib,
	saveDrivePackageFolder as saveDrivePackageFolderLib,
	saveDriveSessionFolder as saveDriveSessionFolderLib,
	saveDriveSetupResult as saveDriveSetupResultLib
} from "#convex/lib/drive/driveFolders";
import { getDriveSetup as loadDriveSetup } from "#convex/lib/drive/driveLookup";
import {
	allocateClientSessionNumber as allocateClientSessionNumberLib,
	allocatePackageSessionNumber as allocatePackageSessionNumberLib
} from "#convex/lib/drive/sessionFolders/allocateNumbers";
import { clearSessionDriveDb as clearSessionDriveDbLib } from "#convex/lib/drive/sessionFolders/clearSessionRecords";

export function getDriveSetup(ctx: QueryCtx, bookingId: Id<"bookings">) {
	return loadDriveSetup(ctx, bookingId);
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

export function syncBookingDriveClientIdFromSession(ctx: MutationCtx, bookingId: Id<"bookings">) {
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
) {
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

export function getEditorDriveSetup(ctx: QueryCtx, bookingId: Id<"bookings">) {
	return loadDriveSetup(ctx, bookingId).andThen((setup) => loadEditorDriveSetup(ctx, setup));
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
	args: {
		bookingId: Id<"bookings">;
		editorTokenIdentifier: string;
		name: "Assets" | "Deliverables" | "Session";
		permission: Parameters<typeof writeEditorDrivePermissionForSetup>[2]["permission"];
	}
) {
	return loadDriveSetup(ctx, args.bookingId).andThen((setup) => {
		if (
			setup === null ||
			setup.driveClient === null ||
			setup.driveSession === null ||
			setup.booking.assignedEditorTokenIdentifier !== args.editorTokenIdentifier
		) {
			return err({ reason: "DRIVE_RECORD_NOT_FOUND" as const });
		}

		return writeEditorDrivePermissionForSetup(
			ctx,
			{ driveClient: setup.driveClient, driveSession: setup.driveSession },
			args
		);
	});
}

export function saveEditorDrivePermissionsStatus(
	ctx: MutationCtx,
	args: { bookingId: Id<"bookings">; editorTokenIdentifier: string; status: "failed" | "ready" }
) {
	return loadDriveSetup(ctx, args.bookingId).andThen((setup) => {
		if (
			setup?.driveSession === null ||
			setup?.driveSession === undefined ||
			setup.booking.assignedEditorTokenIdentifier !== args.editorTokenIdentifier
		) {
			return err({ reason: "DRIVE_RECORD_NOT_FOUND" as const });
		}

		return writeEditorDrivePermissionsStatusForSetup(ctx, setup.driveSession, args);
	});
}

export function claimEditorAssignmentEmail(
	ctx: MutationCtx,
	args: { bookingId: Id<"bookings">; editorTokenIdentifier: string; now: number }
) {
	return loadDriveSetup(ctx, args.bookingId).andThen((setup) => {
		if (
			setup?.driveSession === null ||
			setup?.driveSession === undefined ||
			setup.booking.assignedEditorTokenIdentifier !== args.editorTokenIdentifier ||
			setup.driveSession.editorDrivePermissionsStatus !== "ready" ||
			setup.driveSession.editorDrivePermissionsTokenIdentifier !== args.editorTokenIdentifier
		) {
			return err({ reason: "EDITOR_ASSIGNMENT_EMAIL_NOT_SENDABLE" as const });
		}

		return claimEditorAssignmentEmailForSetup(
			ctx,
			{ ...setup, driveSession: setup.driveSession },
			args
		);
	});
}

export function saveEditorAssignmentEmailResult(
	ctx: MutationCtx,
	args: Parameters<typeof saveEditorAssignmentEmailResultLib>[1]
) {
	return saveEditorAssignmentEmailResultLib(ctx, args);
}

export function saveClientDrivePermission(
	ctx: MutationCtx,
	args: {
		bookingId: Id<"bookings">;
		name: "Client folder" | "Assets";
		permission: Parameters<typeof writeClientDrivePermissionForClient>[2]["permission"];
	}
) {
	return loadDriveSessionRowByBookingId(ctx, args.bookingId).andThen((driveSession) => {
		if (driveSession === null) return err({ reason: "DRIVE_RECORD_NOT_FOUND" as const });

		return loadDriveClientRow(ctx, driveSession.driveClientId).andThen((driveClient) => {
			if (driveClient === null) return err({ reason: "DRIVE_RECORD_NOT_FOUND" as const });

			return writeClientDrivePermissionForClient(ctx, driveClient, args);
		});
	});
}

export function saveClientDrivePermissionsStatus(
	ctx: MutationCtx,
	args: { bookingId: Id<"bookings">; status: "failed" | "ready" | "skipped" }
) {
	return loadDriveSessionRowByBookingId(ctx, args.bookingId).andThen((driveSession) => {
		if (driveSession === null) return err({ reason: "DRIVE_RECORD_NOT_FOUND" as const });

		return writeClientDrivePermissionsStatusForSession(ctx, driveSession, args.status);
	});
}

export function claimClientAssetsEmail(
	ctx: MutationCtx,
	args: { bookingId: Id<"bookings">; attempt: "automatic" | "retry"; now: number }
) {
	return loadBookingRow(ctx, args.bookingId).andThen((booking) => {
		if (
			booking === null ||
			booking.driveClientId === undefined ||
			!bookingRequiresClientAssetsEmail(booking.addons)
		) {
			return err({ reason: "CLIENT_ASSETS_EMAIL_NOT_SENDABLE" as const });
		}

		return loadClientAssetsEmailRows(ctx, {
			bookingId: args.bookingId,
			driveClientId: booking.driveClientId
		}).andThen(([driveClient, driveSession]) => {
			const assetsFolder = driveClient?.assetsFolder;

			if (driveSession === null || assetsFolder === undefined) {
				return err({ reason: "CLIENT_ASSETS_EMAIL_NOT_SENDABLE" as const });
			}

			return claimClientAssetsEmailForSendable(ctx, {
				attempt: args.attempt,
				assetsFolder,
				booking,
				driveClient: driveClient ?? null,
				driveSession,
				now: args.now
			});
		});
	});
}

export function saveClientAssetsEmailResult(
	ctx: MutationCtx,
	args: Parameters<typeof saveClientAssetsEmailResultLib>[1]
) {
	return saveClientAssetsEmailResultLib(ctx, args);
}

export function clearSessionDriveDb(
	ctx: MutationCtx,
	args: Parameters<typeof clearSessionDriveDbLib>[1]
) {
	return clearSessionDriveDbLib(ctx, args);
}
