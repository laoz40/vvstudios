import { errAsync, okAsync } from "neverthrow";
import type { Doc, Id } from "#convex/_generated/dataModel";
import type { MutationCtx } from "#convex/_generated/server";
import {
	linkBookingDriveClientFromRow,
	loadBookingRow,
	loadDriveClientRow,
	loadDriveSessionRowByBookingId,
	syncBookingDriveClientIdFromSessionRows
} from "#convex/lib/drive/driveBookingDriveClient";
import {
	clientSessionNumberFromExistingSession,
	packageSessionNumberFromExistingSession,
	saveClientSessionNumber,
	savePackageSessionNumber,
	type PackageBooking,
	type PackageSessionNumberAllocation,
	type ClientSessionNumberAllocation,
	type StandaloneBooking
} from "#convex/lib/drive/sessionFolders/allocateNumbers";
import {
	clearSavedDriveFolder as clearSavedDriveFolderLib,
	getOrCreateDriveClientIdForRow,
	loadDriveClientByNormalizedEmail,
	saveDriveChildFolderForRow,
	saveDriveClientAssetsFolderForRow,
	saveDriveClientFolderForRow,
	saveDrivePackageFolderForRow,
	saveDriveSessionFolderForRow,
	saveDriveSetupResult as saveDriveSetupResultLib
} from "#convex/lib/drive/driveFolders";
import { clearSessionDriveDbForSession } from "#convex/lib/drive/sessionFolders/clearSessionRecords";

export { getDriveSetup } from "#convex/services/drive/driveSetupQuery";

export {
	claimEditorAssignmentEmail,
	clearPreviousEditorDriveAccess,
	getEditorDriveAccessToRemove,
	getEditorDriveSetup,
	getFailedEditorRemoval,
	markPreviousEditorRemovalFailed,
	saveEditorAssignmentEmailResult,
	saveEditorDrivePermission,
	saveEditorDrivePermissionsStatus
} from "#convex/services/drive/driveInternalEditor";

export {
	claimClientAssetsEmail,
	saveClientAssetsEmailResult,
	saveClientDrivePermission,
	saveClientDrivePermissionsStatus
} from "#convex/services/drive/driveInternalClientAccess";

function standaloneBookingFromRow(ctx: MutationCtx, booking: Doc<"bookings"> | null) {
	if (booking === null) return errAsync({ reason: "BOOKING_NOT_FOUND" as const });

	if (booking.packageId !== undefined) {
		return errAsync({ reason: "BOOKING_IS_PACKAGE" as const });
	}

	if (booking.driveClientId !== undefined) {
		return okAsync({ booking, driveClientId: booking.driveClientId } satisfies StandaloneBooking);
	}

	return loadDriveClientByNormalizedEmail(ctx, booking.email.trim().toLowerCase()).andThen(
		standaloneBookingFromDriveClient(booking)
	);
}

function standaloneBookingFromDriveClient(booking: Doc<"bookings">) {
	return (driveClient: Doc<"driveClients"> | null) => {
		if (driveClient === null) return errAsync({ reason: "DRIVE_RECORD_NOT_FOUND" as const });

		return okAsync({ booking, driveClientId: driveClient._id } satisfies StandaloneBooking);
	};
}

function packageBookingFromRow(booking: Doc<"bookings"> | null) {
	if (booking === null) return errAsync({ reason: "BOOKING_NOT_FOUND" as const });

	if (booking.packageId === undefined) {
		return errAsync({ reason: "BOOKING_NOT_PACKAGE" as const });
	}

	return okAsync({ booking, packageId: booking.packageId } satisfies PackageBooking);
}

export function linkBookingDriveClient(
	ctx: MutationCtx,
	bookingId: Id<"bookings">,
	driveClientId: Id<"driveClients">
) {
	return loadBookingRow(ctx, bookingId).andThen(
		linkBookingDriveClientFromRowForId(ctx, bookingId, driveClientId)
	);
}

function linkBookingDriveClientFromRowForId(
	ctx: MutationCtx,
	bookingId: Id<"bookings">,
	driveClientId: Id<"driveClients">
) {
	return (booking: Doc<"bookings"> | null) =>
		linkBookingDriveClientFromRow(ctx, booking, bookingId, driveClientId);
}

export function getOrCreateDriveClientId(
	ctx: MutationCtx,
	client: { email: string; displayName: string }
) {
	const normalizedEmail = client.email.trim().toLowerCase();

	return loadDriveClientByNormalizedEmail(ctx, normalizedEmail).andThen(
		getOrCreateDriveClientIdForClient(ctx, { ...client, normalizedEmail })
	);
}

function getOrCreateDriveClientIdForClient(
	ctx: MutationCtx,
	client: { email: string; displayName: string; normalizedEmail: string }
) {
	return (existingClient: Doc<"driveClients"> | null) =>
		getOrCreateDriveClientIdForRow(ctx, existingClient, client);
}

export function saveDriveClientFolder(
	ctx: MutationCtx,
	args: Parameters<typeof saveDriveClientFolderForRow>[2]
) {
	return loadDriveClientByNormalizedEmail(ctx, args.normalizedEmail).andThen(
		saveDriveClientFolderForExistingRow(ctx, args)
	);
}

function saveDriveClientFolderForExistingRow(
	ctx: MutationCtx,
	args: Parameters<typeof saveDriveClientFolderForRow>[2]
) {
	return (existingClient: Doc<"driveClients"> | null) =>
		saveDriveClientFolderForRow(ctx, existingClient, args);
}

export function saveDriveSessionFolder(
	ctx: MutationCtx,
	args: {
		bookingId: Id<"bookings">;
		driveClientId: Id<"driveClients">;
		folder: Parameters<typeof saveDriveSessionFolderForRow>[2]["folder"];
	}
) {
	return loadDriveSessionRowByBookingId(ctx, args.bookingId)
		.andThen(saveDriveSessionFolderForExistingRow(ctx, args))
		.andThen(linkBookingDriveClientAfterSessionFolderSave(ctx, args));
}

function saveDriveSessionFolderForExistingRow(
	ctx: MutationCtx,
	args: Parameters<typeof saveDriveSessionFolder>[1]
) {
	return (existingSession: Doc<"driveSessions"> | null) =>
		saveDriveSessionFolderForRow(ctx, existingSession, args);
}

function linkBookingDriveClientAfterSessionFolderSave(
	ctx: MutationCtx,
	args: Parameters<typeof saveDriveSessionFolder>[1]
) {
	return (folderId: Id<"driveSessions"> | string) =>
		linkBookingDriveClient(ctx, args.bookingId, args.driveClientId).map(returnFolderId(folderId));
}

function returnFolderId<T>(folderId: T) {
	return () => folderId;
}

export function syncBookingDriveClientIdFromSession(ctx: MutationCtx, bookingId: Id<"bookings">) {
	return loadBookingRow(ctx, bookingId).andThen(
		syncBookingDriveClientIdFromLoadedSession(ctx, bookingId)
	);
}

function syncBookingDriveClientIdFromLoadedSession(ctx: MutationCtx, bookingId: Id<"bookings">) {
	return (booking: Doc<"bookings"> | null) =>
		loadDriveSessionRowByBookingId(ctx, bookingId).andThen(
			syncBookingDriveClientIdFromSessionRowsStep(ctx, booking, bookingId)
		);
}

function syncBookingDriveClientIdFromSessionRowsStep(
	ctx: MutationCtx,
	booking: Doc<"bookings"> | null,
	bookingId: Id<"bookings">
) {
	return (driveSession: Doc<"driveSessions"> | null) =>
		syncBookingDriveClientIdFromSessionRows(ctx, booking, bookingId, driveSession);
}

export function saveDrivePackageFolder(
	ctx: MutationCtx,
	args: {
		bookingId: Id<"bookings">;
		folder: Parameters<typeof saveDrivePackageFolderForRow>[2]["folder"];
	}
) {
	return loadDriveSessionRowByBookingId(ctx, args.bookingId).andThen(
		saveDrivePackageFolderForSessionOrBooking(ctx, args)
	);
}

function saveDrivePackageFolderForSessionOrBooking(
	ctx: MutationCtx,
	args: Parameters<typeof saveDrivePackageFolder>[1]
) {
	return (driveSession: Doc<"driveSessions"> | null) => {
		if (driveSession !== null) {
			return saveDrivePackageFolderForRow(ctx, driveSession, args, null);
		}

		return loadBookingRow(ctx, args.bookingId).andThen(
			saveDrivePackageFolderForBookingRow(ctx, args)
		);
	};
}

function saveDrivePackageFolderForBookingRow(
	ctx: MutationCtx,
	args: Parameters<typeof saveDrivePackageFolder>[1]
) {
	return (booking: Doc<"bookings"> | null) =>
		saveDrivePackageFolderForRow(ctx, null, args, booking);
}

export function allocatePackageSessionNumber(
	ctx: MutationCtx,
	args: { bookingId: Id<"bookings"> }
) {
	return loadBookingRow(ctx, args.bookingId)
		.andThen(packageBookingFromRow)
		.andThen(allocatePackageSessionNumberForBooking(ctx))
		.andThen(saveAllocatedPackageSessionNumber(ctx));
}

function allocatePackageSessionNumberForBooking(ctx: MutationCtx) {
	return (packageBooking: PackageBooking) =>
		loadDriveSessionRowByBookingId(ctx, packageBooking.booking._id).andThen(
			packageSessionNumberFromExistingSessionStep(ctx, packageBooking)
		);
}

function packageSessionNumberFromExistingSessionStep(
	ctx: MutationCtx,
	packageBooking: PackageBooking
) {
	return (existingSession: Doc<"driveSessions"> | null) =>
		packageSessionNumberFromExistingSession(ctx, existingSession, packageBooking);
}

function saveAllocatedPackageSessionNumber(ctx: MutationCtx) {
	return (allocation: PackageSessionNumberAllocation) => {
		if (allocation.kind === "already_saved") return okAsync(allocation.number);

		return savePackageSessionNumber(ctx, allocation);
	};
}

export function allocateClientSessionNumber(ctx: MutationCtx, args: { bookingId: Id<"bookings"> }) {
	return loadBookingRow(ctx, args.bookingId)
		.andThen(standaloneBookingFromRowStep(ctx))
		.andThen(allocateClientSessionNumberForBooking(ctx))
		.andThen(saveAllocatedClientSessionNumber(ctx));
}

function standaloneBookingFromRowStep(ctx: MutationCtx) {
	return (booking: Doc<"bookings"> | null) => standaloneBookingFromRow(ctx, booking);
}

function allocateClientSessionNumberForBooking(ctx: MutationCtx) {
	return (standaloneBooking: StandaloneBooking) =>
		loadDriveSessionRowByBookingId(ctx, standaloneBooking.booking._id).andThen(
			clientSessionNumberFromExistingSessionStep(ctx, standaloneBooking)
		);
}

function clientSessionNumberFromExistingSessionStep(
	ctx: MutationCtx,
	standaloneBooking: StandaloneBooking
) {
	return (existingSession: Doc<"driveSessions"> | null) =>
		clientSessionNumberFromExistingSession(ctx, existingSession, standaloneBooking);
}

function saveAllocatedClientSessionNumber(ctx: MutationCtx) {
	return (allocation: ClientSessionNumberAllocation) => {
		if (allocation.kind === "already_saved") return okAsync(allocation.number);

		return saveClientSessionNumber(ctx, allocation);
	};
}

export function saveDriveClientAssetsFolder(
	ctx: MutationCtx,
	args: {
		driveClientId: Id<"driveClients">;
		folder: Parameters<typeof saveDriveClientAssetsFolderForRow>[2]["folder"];
	}
) {
	return loadDriveClientRow(ctx, args.driveClientId).andThen(
		saveDriveClientAssetsFolderForLoadedRow(ctx, args)
	);
}

function saveDriveClientAssetsFolderForLoadedRow(
	ctx: MutationCtx,
	args: Parameters<typeof saveDriveClientAssetsFolder>[1]
) {
	return (driveClient: Doc<"driveClients"> | null) =>
		saveDriveClientAssetsFolderForRow(ctx, driveClient, args);
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
	args: {
		bookingId: Id<"bookings">;
		name: Parameters<typeof saveDriveChildFolderForRow>[2]["name"];
		folder: Parameters<typeof saveDriveChildFolderForRow>[2]["folder"];
	}
) {
	return loadDriveSessionRowByBookingId(ctx, args.bookingId).andThen(
		saveDriveChildFolderForLoadedSession(ctx, args)
	);
}

function saveDriveChildFolderForLoadedSession(
	ctx: MutationCtx,
	args: Parameters<typeof saveDriveChildFolder>[1]
) {
	return (driveSession: Doc<"driveSessions"> | null) =>
		saveDriveChildFolderForRow(ctx, driveSession, args);
}

export function clearSessionDriveDb(ctx: MutationCtx, args: { bookingId: Id<"bookings"> }) {
	return loadDriveSessionRowByBookingId(ctx, args.bookingId).andThen(
		clearSessionDriveDbForLoadedSession(ctx)
	);
}

function clearSessionDriveDbForLoadedSession(ctx: MutationCtx) {
	return (driveSession: Doc<"driveSessions"> | null) =>
		clearSessionDriveDbForSession(ctx, driveSession);
}
