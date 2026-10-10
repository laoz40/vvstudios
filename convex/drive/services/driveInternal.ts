import { errAsync, okAsync } from "neverthrow";
import type { Doc, Id } from "#convex/_generated/dataModel";
import type { MutationCtx } from "#convex/_generated/server";
import {
	linkBookingDriveClientFromRow,
	loadBookingRow,
	loadDriveClientRow,
	loadDriveSessionRowByBookingId,
	syncBookingDriveClientIdFromSessionRows
} from "#convex/drive/lib/driveBookingDriveClient";
import {
	clientSessionNumberFromExistingSession,
	packageSessionNumberFromExistingSession,
	saveClientSessionNumber,
	savePackageSessionNumber,
	type PackageBooking,
	type PackageSessionNumberAllocation,
	type ClientSessionNumberAllocation,
	type StandaloneBooking
} from "#convex/drive/lib/sessionFolders/allocateNumbers";
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
} from "#convex/drive/lib/driveFolders";
import { clearSessionDriveDbForSession } from "#convex/drive/lib/sessionFolders/clearSessionRecords";

export { getDriveSetup } from "#convex/drive/services/driveSetupQuery";

export {
	claimEditorAssignmentEmail,
	clearEditorAssetPermission,
	clearPreviousEditorDriveAccess,
	getEditorDriveAccessToRemove,
	getEditorRetirementAssets,
	getEditorRetirementSessions,
	markEditorDriveAccessRevoked,
	getEditorDriveSetup,
	getFailedEditorRemoval,
	markPreviousEditorRemovalFailed,
	saveEditorAssignmentEmailResult,
	saveEditorDrivePermission,
	saveEditorDrivePermissionsStatus
} from "#convex/drive/services/driveInternalEditor";

export {
	claimClientAssetsEmail,
	saveClientAssetsEmailResult,
	saveClientDrivePermission,
	saveClientDrivePermissionsStatus
} from "#convex/drive/services/driveInternalClientAccess";

function standaloneBookingFromRow(ctx: MutationCtx, booking: Doc<"bookings"> | null) {
	if (booking === null) return errAsync({ reason: "BOOKING_NOT_FOUND" as const });

	if (booking.packageId !== undefined) {
		return errAsync({ reason: "BOOKING_IS_PACKAGE" as const });
	}

	if (booking.driveClientId !== undefined) {
		return okAsync({ booking, driveClientId: booking.driveClientId } satisfies StandaloneBooking);
	}

	return loadDriveClientByNormalizedEmail(ctx, booking.email.trim().toLowerCase()).andThen(
		(driveClient: Doc<"driveClients"> | null) =>
			standaloneBookingFromDriveClient(booking, driveClient)
	);
}

function standaloneBookingFromDriveClient(
	booking: Doc<"bookings">,
	driveClient: Doc<"driveClients"> | null
) {
	if (driveClient === null) return errAsync({ reason: "DRIVE_RECORD_NOT_FOUND" as const });

	return okAsync({ booking, driveClientId: driveClient._id } satisfies StandaloneBooking);
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
	return loadBookingRow(ctx, bookingId).andThen((booking: Doc<"bookings"> | null) =>
		linkBookingDriveClientFromRowForId(ctx, bookingId, driveClientId, booking)
	);
}

function linkBookingDriveClientFromRowForId(
	ctx: MutationCtx,
	bookingId: Id<"bookings">,
	driveClientId: Id<"driveClients">,
	booking: Doc<"bookings"> | null
) {
	return linkBookingDriveClientFromRow(ctx, booking, bookingId, driveClientId);
}

export function getOrCreateDriveClientId(
	ctx: MutationCtx,
	client: { email: string; displayName: string }
) {
	const normalizedEmail = client.email.trim().toLowerCase();

	return loadDriveClientByNormalizedEmail(ctx, normalizedEmail).andThen(
		(existingClient: Doc<"driveClients"> | null) =>
			getOrCreateDriveClientIdForClient(ctx, { ...client, normalizedEmail }, existingClient)
	);
}

function getOrCreateDriveClientIdForClient(
	ctx: MutationCtx,
	client: { email: string; displayName: string; normalizedEmail: string },
	existingClient: Doc<"driveClients"> | null
) {
	return getOrCreateDriveClientIdForRow(ctx, existingClient, client);
}

export function saveDriveClientFolder(
	ctx: MutationCtx,
	args: Parameters<typeof saveDriveClientFolderForRow>[2]
) {
	return loadDriveClientByNormalizedEmail(ctx, args.normalizedEmail).andThen(
		(existingClient: Doc<"driveClients"> | null) =>
			saveDriveClientFolderForExistingRow(ctx, args, existingClient)
	);
}

function saveDriveClientFolderForExistingRow(
	ctx: MutationCtx,
	args: Parameters<typeof saveDriveClientFolderForRow>[2],
	existingClient: Doc<"driveClients"> | null
) {
	return saveDriveClientFolderForRow(ctx, existingClient, args);
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
		.andThen((existingSession: Doc<"driveSessions"> | null) =>
			saveDriveSessionFolderForExistingRow(ctx, args, existingSession)
		)
		.andThen((folderId: Id<"driveSessions"> | string) =>
			linkBookingDriveClientAfterSessionFolderSave(ctx, args, folderId)
		);
}

function saveDriveSessionFolderForExistingRow(
	ctx: MutationCtx,
	args: Parameters<typeof saveDriveSessionFolder>[1],
	existingSession: Doc<"driveSessions"> | null
) {
	return saveDriveSessionFolderForRow(ctx, existingSession, args);
}

function linkBookingDriveClientAfterSessionFolderSave(
	ctx: MutationCtx,
	args: Parameters<typeof saveDriveSessionFolder>[1],
	folderId: Id<"driveSessions"> | string
) {
	return linkBookingDriveClient(ctx, args.bookingId, args.driveClientId).map(() =>
		returnFolderId(folderId)
	);
}

function returnFolderId<T>(folderId: T) {
	return folderId;
}

export function syncBookingDriveClientIdFromSession(ctx: MutationCtx, bookingId: Id<"bookings">) {
	return loadBookingRow(ctx, bookingId).andThen((booking: Doc<"bookings"> | null) =>
		syncBookingDriveClientIdFromLoadedSession(ctx, bookingId, booking)
	);
}

function syncBookingDriveClientIdFromLoadedSession(
	ctx: MutationCtx,
	bookingId: Id<"bookings">,
	booking: Doc<"bookings"> | null
) {
	return loadDriveSessionRowByBookingId(ctx, bookingId).andThen(
		(driveSession: Doc<"driveSessions"> | null) =>
			syncBookingDriveClientIdFromSessionRowsStep(ctx, booking, bookingId, driveSession)
	);
}

function syncBookingDriveClientIdFromSessionRowsStep(
	ctx: MutationCtx,
	booking: Doc<"bookings"> | null,
	bookingId: Id<"bookings">,
	driveSession: Doc<"driveSessions"> | null
) {
	return syncBookingDriveClientIdFromSessionRows(ctx, booking, bookingId, driveSession);
}

export function saveDrivePackageFolder(
	ctx: MutationCtx,
	args: {
		bookingId: Id<"bookings">;
		folder: Parameters<typeof saveDrivePackageFolderForRow>[2]["folder"];
	}
) {
	return loadDriveSessionRowByBookingId(ctx, args.bookingId).andThen(
		(driveSession: Doc<"driveSessions"> | null) =>
			saveDrivePackageFolderForSessionOrBooking(ctx, args, driveSession)
	);
}

function saveDrivePackageFolderForSessionOrBooking(
	ctx: MutationCtx,
	args: Parameters<typeof saveDrivePackageFolder>[1],
	driveSession: Doc<"driveSessions"> | null
) {
	if (driveSession !== null) {
		return saveDrivePackageFolderForRow(ctx, driveSession, args, null);
	}

	return loadBookingRow(ctx, args.bookingId).andThen((booking: Doc<"bookings"> | null) =>
		saveDrivePackageFolderForBookingRow(ctx, args, booking)
	);
}

function saveDrivePackageFolderForBookingRow(
	ctx: MutationCtx,
	args: Parameters<typeof saveDrivePackageFolder>[1],
	booking: Doc<"bookings"> | null
) {
	return saveDrivePackageFolderForRow(ctx, null, args, booking);
}

export function allocatePackageSessionNumber(
	ctx: MutationCtx,
	args: { bookingId: Id<"bookings"> }
) {
	return loadBookingRow(ctx, args.bookingId)
		.andThen(packageBookingFromRow)
		.andThen((packageBooking: PackageBooking) =>
			allocatePackageSessionNumberForBooking(ctx, packageBooking)
		)
		.andThen((allocation: PackageSessionNumberAllocation) =>
			saveAllocatedPackageSessionNumber(ctx, allocation)
		);
}

function allocatePackageSessionNumberForBooking(ctx: MutationCtx, packageBooking: PackageBooking) {
	return loadDriveSessionRowByBookingId(ctx, packageBooking.booking._id).andThen(
		(existingSession: Doc<"driveSessions"> | null) =>
			packageSessionNumberFromExistingSessionStep(ctx, packageBooking, existingSession)
	);
}

function packageSessionNumberFromExistingSessionStep(
	ctx: MutationCtx,
	packageBooking: PackageBooking,
	existingSession: Doc<"driveSessions"> | null
) {
	return packageSessionNumberFromExistingSession(ctx, existingSession, packageBooking);
}

function saveAllocatedPackageSessionNumber(
	ctx: MutationCtx,
	allocation: PackageSessionNumberAllocation
) {
	if (allocation.kind === "already_saved") return okAsync(allocation.number);

	return savePackageSessionNumber(ctx, allocation);
}

export function allocateClientSessionNumber(ctx: MutationCtx, args: { bookingId: Id<"bookings"> }) {
	return loadBookingRow(ctx, args.bookingId)
		.andThen((booking: Doc<"bookings"> | null) => standaloneBookingFromRowStep(ctx, booking))
		.andThen((standaloneBooking: StandaloneBooking) =>
			allocateClientSessionNumberForBooking(ctx, standaloneBooking)
		)
		.andThen((allocation: ClientSessionNumberAllocation) =>
			saveAllocatedClientSessionNumber(ctx, allocation)
		);
}

function standaloneBookingFromRowStep(ctx: MutationCtx, booking: Doc<"bookings"> | null) {
	return standaloneBookingFromRow(ctx, booking);
}

function allocateClientSessionNumberForBooking(
	ctx: MutationCtx,
	standaloneBooking: StandaloneBooking
) {
	return loadDriveSessionRowByBookingId(ctx, standaloneBooking.booking._id).andThen(
		(existingSession: Doc<"driveSessions"> | null) =>
			clientSessionNumberFromExistingSessionStep(ctx, standaloneBooking, existingSession)
	);
}

function clientSessionNumberFromExistingSessionStep(
	ctx: MutationCtx,
	standaloneBooking: StandaloneBooking,
	existingSession: Doc<"driveSessions"> | null
) {
	return clientSessionNumberFromExistingSession(ctx, existingSession, standaloneBooking);
}

function saveAllocatedClientSessionNumber(
	ctx: MutationCtx,
	allocation: ClientSessionNumberAllocation
) {
	if (allocation.kind === "already_saved") return okAsync(allocation.number);

	return saveClientSessionNumber(ctx, allocation);
}

export function saveDriveClientAssetsFolder(
	ctx: MutationCtx,
	args: {
		driveClientId: Id<"driveClients">;
		folder: Parameters<typeof saveDriveClientAssetsFolderForRow>[2]["folder"];
	}
) {
	return loadDriveClientRow(ctx, args.driveClientId).andThen(
		(driveClient: Doc<"driveClients"> | null) =>
			saveDriveClientAssetsFolderForLoadedRow(ctx, args, driveClient)
	);
}

function saveDriveClientAssetsFolderForLoadedRow(
	ctx: MutationCtx,
	args: Parameters<typeof saveDriveClientAssetsFolder>[1],
	driveClient: Doc<"driveClients"> | null
) {
	return saveDriveClientAssetsFolderForRow(ctx, driveClient, args);
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
		(driveSession: Doc<"driveSessions"> | null) =>
			saveDriveChildFolderForLoadedSession(ctx, args, driveSession)
	);
}

function saveDriveChildFolderForLoadedSession(
	ctx: MutationCtx,
	args: Parameters<typeof saveDriveChildFolder>[1],
	driveSession: Doc<"driveSessions"> | null
) {
	return saveDriveChildFolderForRow(ctx, driveSession, args);
}

export function clearSessionDriveDb(ctx: MutationCtx, args: { bookingId: Id<"bookings"> }) {
	return loadDriveSessionRowByBookingId(ctx, args.bookingId).andThen(
		(driveSession: Doc<"driveSessions"> | null) =>
			clearSessionDriveDbForLoadedSession(ctx, driveSession)
	);
}

function clearSessionDriveDbForLoadedSession(
	ctx: MutationCtx,
	driveSession: Doc<"driveSessions"> | null
) {
	return clearSessionDriveDbForSession(ctx, driveSession);
}
