import { ok, safeTry } from "neverthrow";
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
	return safeTry(async function* () {
		const client = yield* loadStandaloneDriveClient(ctx, booking);
		const standaloneBooking = yield* resolveStandaloneBooking(booking, client);

		return ok(standaloneBooking);
	});
}

export function linkBookingDriveClient(
	ctx: MutationCtx,
	bookingId: Id<"bookings">,
	driveClientId: Id<"driveClients">
) {
	return safeTry(async function* () {
		const booking = yield* loadBookingRow(ctx, bookingId);
		const linked = yield* linkBookingDriveClientFromRow(ctx, booking, bookingId, driveClientId);

		return ok(linked);
	});
}

export function getOrCreateDriveClientId(
	ctx: MutationCtx,
	client: { email: string; displayName: string }
) {
	return safeTry(async function* () {
		const existingClient = yield* loadDriveClientByNormalizedEmail(
			ctx,
			client.email.trim().toLowerCase()
		);

		const driveClientId = yield* getOrCreateDriveClientIdForRow(ctx, existingClient, {
			...client,
			normalizedEmail: client.email.trim().toLowerCase()
		});

		return ok(driveClientId);
	});
}

export function saveDriveClientFolder(
	ctx: MutationCtx,
	args: Parameters<typeof saveDriveClientFolderForRow>[2]
) {
	return safeTry(async function* () {
		const existingClient = yield* loadDriveClientByNormalizedEmail(ctx, args.normalizedEmail);
		const folder = yield* saveDriveClientFolderForRow(ctx, existingClient, args);

		return ok(folder);
	});
}

export function saveDriveSessionFolder(
	ctx: MutationCtx,
	args: {
		bookingId: Id<"bookings">;
		driveClientId: Id<"driveClients">;
		folder: Parameters<typeof saveDriveSessionFolderForRow>[2]["folder"];
	}
) {
	return safeTry(async function* () {
		const existingSession = yield* loadDriveSessionRowByBookingId(ctx, args.bookingId);
		const folderId = yield* saveDriveSessionFolderForRow(ctx, existingSession, args);
		yield* linkBookingDriveClient(ctx, args.bookingId, args.driveClientId);

		return ok(folderId);
	});
}

export function syncBookingDriveClientIdFromSession(ctx: MutationCtx, bookingId: Id<"bookings">) {
	return safeTry(async function* () {
		const booking = yield* loadBookingRow(ctx, bookingId);
		const synced = yield* syncBookingDriveClientIdFromLoadedSession(ctx, bookingId, booking);

		return ok(synced);
	});
}

function syncBookingDriveClientIdFromLoadedSession(
	ctx: MutationCtx,
	bookingId: Id<"bookings">,
	booking: Doc<"bookings"> | null
) {
	return safeTry(async function* () {
		const driveSession = yield* loadDriveSessionRowByBookingId(ctx, bookingId);

		const synced = yield* syncBookingDriveClientIdFromSessionRows(
			ctx,
			booking,
			bookingId,
			driveSession
		);

		return ok(synced);
	});
}

export function saveDrivePackageFolder(
	ctx: MutationCtx,
	args: {
		bookingId: Id<"bookings">;
		folder: Parameters<typeof saveDrivePackageFolderForRow>[2]["folder"];
	}
) {
	return safeTry(async function* () {
		const driveSession = yield* loadDriveSessionRowByBookingId(ctx, args.bookingId);
		const folder = yield* saveDrivePackageFolderForSessionOrBooking(ctx, args, driveSession);

		return ok(folder);
	});
}

function saveDrivePackageFolderForSessionOrBooking(
	ctx: MutationCtx,
	args: Parameters<typeof saveDrivePackageFolder>[1],
	driveSession: Doc<"driveSessions"> | null
) {
	return safeTry(async function* () {
		const booking = yield* loadBookingForPackageFolder(ctx, args.bookingId, driveSession);
		const folder = yield* saveDrivePackageFolderForRow(ctx, driveSession, args, booking);

		return ok(folder);
	});
}

export function allocatePackageSessionNumber(
	ctx: MutationCtx,
	args: { bookingId: Id<"bookings"> }
) {
	return safeTry(async function* () {
		const booking = yield* loadBookingRow(ctx, args.bookingId);
		const packageBooking = yield* requirePackageBooking(booking);
		const allocation = yield* allocatePackageSessionNumberForBooking(ctx, packageBooking);
		const number = yield* savePackageSessionNumber(ctx, allocation);

		return ok(number);
	});
}

function allocatePackageSessionNumberForBooking(ctx: MutationCtx, packageBooking: PackageBooking) {
	return safeTry(async function* () {
		const existingSession = yield* loadDriveSessionRowByBookingId(ctx, packageBooking.booking._id);

		const allocation = yield* packageSessionNumberFromExistingSession(
			ctx,
			existingSession,
			packageBooking
		);

		return ok(allocation);
	});
}

export function allocateClientSessionNumber(ctx: MutationCtx, args: { bookingId: Id<"bookings"> }) {
	return safeTry(async function* () {
		const booking = yield* loadBookingRow(ctx, args.bookingId);
		const standaloneBooking = yield* requireStandaloneBooking(booking);
		const resolvedBooking = yield* resolveStandaloneDriveClient(ctx, standaloneBooking);
		const allocation = yield* allocateClientSessionNumberForBooking(ctx, resolvedBooking);
		const number = yield* saveClientSessionNumber(ctx, allocation);

		return ok(number);
	});
}

function allocateClientSessionNumberForBooking(
	ctx: MutationCtx,
	standaloneBooking: StandaloneBooking
) {
	return safeTry(async function* () {
		const existingSession = yield* loadDriveSessionRowByBookingId(
			ctx,
			standaloneBooking.booking._id
		);

		const allocation = yield* clientSessionNumberFromExistingSession(
			ctx,
			existingSession,
			standaloneBooking
		);

		return ok(allocation);
	});
}

export function saveDriveClientAssetsFolder(
	ctx: MutationCtx,
	args: {
		driveClientId: Id<"driveClients">;
		folder: Parameters<typeof saveDriveClientAssetsFolderForRow>[2]["folder"];
	}
) {
	return safeTry(async function* () {
		const driveClient = yield* loadDriveClientRow(ctx, args.driveClientId);
		const folder = yield* saveDriveClientAssetsFolderForRow(ctx, driveClient, args);

		return ok(folder);
	});
}

export function saveDriveSetupResult(
	ctx: MutationCtx,
	args: Parameters<typeof saveDriveSetupResultLib>[1]
) {
	return saveDriveSetupResultLib(ctx, args);
}

export function clearSavedDriveFolder(ctx: MutationCtx, args: ClearSavedDriveFolderArgs) {
	return safeTry(async function* () {
		const session = yield* loadDriveSessionForFolderClear(ctx, args);
		const cleared = yield* clearSavedDriveFolderForRow(ctx, args, session);

		return ok(cleared);
	});
}

export function saveDriveChildFolder(
	ctx: MutationCtx,
	args: {
		bookingId: Id<"bookings">;
		name: Parameters<typeof saveDriveChildFolderForRow>[2]["name"];
		folder: Parameters<typeof saveDriveChildFolderForRow>[2]["folder"];
	}
) {
	return safeTry(async function* () {
		const driveSession = yield* loadDriveSessionRowByBookingId(ctx, args.bookingId);
		const folder = yield* saveDriveChildFolderForRow(ctx, driveSession, args);

		return ok(folder);
	});
}

export function clearSessionDriveDb(ctx: MutationCtx, args: { bookingId: Id<"bookings"> }) {
	return safeTry(async function* () {
		const driveSession = yield* loadDriveSessionRowByBookingId(ctx, args.bookingId);
		const cleared = yield* clearSessionDriveDbForSession(ctx, driveSession);

		return ok(cleared);
	});
}
