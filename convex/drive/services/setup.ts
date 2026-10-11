import type { ResultAsync } from "neverthrow";
import type { Doc, Id } from "#convex/_generated/dataModel";
import type { MutationCtx } from "#convex/_generated/server";
import {
	linkBookingDriveClientFromRow,
	loadBookingRow,
	loadDriveClientRow,
	loadDriveSessionRowByBookingId,
	syncBookingDriveClientIdFromSessionRows
} from "#convex/drive/lib/driveBookingDriveClient";
import { savePackageSessionNumber } from "#convex/drive/lib/sessionFolders/allocateNumbers";
import {
	clientSessionNumberFromExistingSession,
	packageSessionNumberFromExistingSession,
	saveClientSessionNumber
} from "#convex/drive/services/sessionFolderAllocation";
import type {
	PackageSessionNumberAllocation,
	ClientSessionNumberAllocation,
	PackageSessionNumberError,
	ClientSessionNumberError,
	PackageBooking,
	StandaloneBooking
} from "#convex/drive/lib/sessionFolders/allocateNumbers";
import {
	type ClearSavedDriveFolderArgs,
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
import {
	requireStandaloneBooking,
	resolveStandaloneBooking,
	requirePackageBooking
} from "#convex/drive/lib/setupValues";
import {
	loadStandaloneDriveClient,
	loadBookingForPackageFolder,
	loadDriveSessionForFolderClear,
	clearSavedDriveFolderForRow
} from "#convex/drive/lib/driveFolders";

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
} from "#convex/drive/services/editorPermissions";

export {
	claimClientAssetsEmail,
	saveClientAssetsEmailResult,
	saveClientDrivePermission,
	saveClientDrivePermissionsStatus
} from "#convex/drive/services/clientAccess";

function resolveStandaloneDriveClient(ctx: MutationCtx, booking: Doc<"bookings">) {
	return loadStandaloneDriveClient(ctx, booking).andThen((client) =>
		resolveStandaloneBooking(booking, client)
	);
}

export function linkBookingDriveClient(
	ctx: MutationCtx,
	bookingId: Id<"bookings">,
	driveClientId: Id<"driveClients">
) {
	return loadBookingRow(ctx, bookingId).andThen((booking: Doc<"bookings"> | null) =>
		linkBookingDriveClientFromRow(ctx, booking, bookingId, driveClientId)
	);
}

export function getOrCreateDriveClientId(
	ctx: MutationCtx,
	client: { email: string; displayName: string }
) {
	return loadDriveClientByNormalizedEmail(ctx, client.email.trim().toLowerCase()).andThen(
		(existingClient: Doc<"driveClients"> | null) =>
			getOrCreateDriveClientIdForRow(ctx, existingClient, {
				...client,
				normalizedEmail: client.email.trim().toLowerCase()
			})
	);
}

export function saveDriveClientFolder(
	ctx: MutationCtx,
	args: Parameters<typeof saveDriveClientFolderForRow>[2]
) {
	return loadDriveClientByNormalizedEmail(ctx, args.normalizedEmail).andThen(
		(existingClient: Doc<"driveClients"> | null) =>
			saveDriveClientFolderForRow(ctx, existingClient, args)
	);
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
			saveDriveSessionFolderForRow(ctx, existingSession, args)
		)
		.andThen((folderId: Id<"driveSessions"> | string) =>
			linkBookingDriveClient(ctx, args.bookingId, args.driveClientId).map(() => folderId)
		);
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
			syncBookingDriveClientIdFromSessionRows(ctx, booking, bookingId, driveSession)
	);
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
	return loadBookingForPackageFolder(ctx, args.bookingId, driveSession).andThen((booking) =>
		saveDrivePackageFolderForRow(ctx, driveSession, args, booking)
	);
}

export function allocatePackageSessionNumber(
	ctx: MutationCtx,
	args: { bookingId: Id<"bookings"> }
): ResultAsync<number, PackageSessionNumberError> {
	return loadBookingRow(ctx, args.bookingId)
		.andThen(requirePackageBooking)
		.andThen((packageBooking: PackageBooking) =>
			allocatePackageSessionNumberForBooking(ctx, packageBooking)
		)
		.andThen((allocation: PackageSessionNumberAllocation) =>
			savePackageSessionNumber(ctx, allocation)
		);
}

function allocatePackageSessionNumberForBooking(ctx: MutationCtx, packageBooking: PackageBooking) {
	return loadDriveSessionRowByBookingId(ctx, packageBooking.booking._id).andThen(
		(existingSession: Doc<"driveSessions"> | null) =>
			packageSessionNumberFromExistingSession(ctx, existingSession, packageBooking)
	);
}

export function allocateClientSessionNumber(
	ctx: MutationCtx,
	args: { bookingId: Id<"bookings"> }
): ResultAsync<number, ClientSessionNumberError> {
	return loadBookingRow(ctx, args.bookingId)
		.andThen(requireStandaloneBooking)
		.andThen((booking) => resolveStandaloneDriveClient(ctx, booking))
		.andThen((standaloneBooking: StandaloneBooking) =>
			allocateClientSessionNumberForBooking(ctx, standaloneBooking)
		)
		.andThen((allocation: ClientSessionNumberAllocation) =>
			saveClientSessionNumber(ctx, allocation)
		);
}

function allocateClientSessionNumberForBooking(
	ctx: MutationCtx,
	standaloneBooking: StandaloneBooking
) {
	return loadDriveSessionRowByBookingId(ctx, standaloneBooking.booking._id).andThen(
		(existingSession: Doc<"driveSessions"> | null) =>
			clientSessionNumberFromExistingSession(ctx, existingSession, standaloneBooking)
	);
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
			saveDriveClientAssetsFolderForRow(ctx, driveClient, args)
	);
}

export function saveDriveSetupResult(
	ctx: MutationCtx,
	args: Parameters<typeof saveDriveSetupResultLib>[1]
) {
	return saveDriveSetupResultLib(ctx, args);
}

export function clearSavedDriveFolder(ctx: MutationCtx, args: ClearSavedDriveFolderArgs) {
	return loadDriveSessionForFolderClear(ctx, args).andThen((session) =>
		clearSavedDriveFolderForRow(ctx, args, session)
	);
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
			saveDriveChildFolderForRow(ctx, driveSession, args)
	);
}

export function clearSessionDriveDb(ctx: MutationCtx, args: { bookingId: Id<"bookings"> }) {
	return loadDriveSessionRowByBookingId(ctx, args.bookingId).andThen(
		(driveSession: Doc<"driveSessions"> | null) => clearSessionDriveDbForSession(ctx, driveSession)
	);
}
