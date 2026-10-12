import { ok, safeTry, type ResultAsync } from "neverthrow";
import type { Doc, Id } from "#convex/_generated/dataModel";
import type { MutationCtx, QueryCtx } from "#convex/_generated/server";
import type { DriveSetupInfo } from "#convex/drive/lib/driveLookup";
import {
	claimEditorAssignmentEmailForEditor,
	clearPreviousEditorDriveAccessForSession,
	editorDriveAccessToRemoveForSession,
	editorDriveSetupFromLoaded,
	failedEditorRemovalForSession,
	loadEditorClientDriveDataWhenAvailable,
	loadEditorProfileByToken,
	listEditorAssetPermissionsForRetirement,
	loadDriveSessionsForBookings,
	listEditorRetirementSessions,
	deleteEditorAssetPermissionIfOwned,
	loadEditorAssetPermissionForClear,
	markEditorDriveAccessRevokedForSession,
	markPreviousEditorRemovalFailedForSession,
	saveEditorAssignmentEmailResultForSession,
	loadEditorAssetsPermission,
	saveEditorPermissionForSetup,
	writeEditorDrivePermissionsStatus
} from "#convex/drive/lib/driveEditor";
import {
	requireEditorPermissionSetup,
	requireEditorPermissionStatusSetup,
	requireEditorAssignmentEmailSetup,
	type EditorPermissionSetupContext
} from "#convex/drive/lib/editorPermissionSteps";
import {
	getCompletedEditorBookingIds,
	loadEditorRetirementAssetInfos,
	mergeEditorRetirementSessions,
	type RetiredAssetPermission
} from "#convex/drive/lib/editorRetirement";
import {
	loadDriveSessionRow,
	loadDriveSessionRowByBookingId
} from "#convex/drive/lib/driveBookingDriveClient";
import { getDriveSetup } from "#convex/drive/services/driveSetupQuery";
import type { DriveEditorPermissionsError } from "#convex/drive/services/editorDrivePermissions";
import { requireActiveEditor } from "#convex/editor/lib/editorAssignments";

export function getEditorDriveSetup(ctx: QueryCtx, bookingId: Id<"bookings">) {
	return safeTry(async function* () {
		const setup = yield* getDriveSetup(ctx, bookingId);

		return ok(yield* loadEditorDriveSetupFromDriveSetup(ctx, setup));
	});
}

function loadEditorDriveSetupFromDriveSetup(ctx: QueryCtx, setup: DriveSetupInfo | null) {
	return safeTry(async function* () {
		const editor = yield* loadEditorProfileByToken(
			ctx,
			setup?.booking.assignedEditorTokenIdentifier ?? null
		);

		return ok(yield* editorDriveSetupFromLoaded(setup, editor));
	});
}

export function getEditorDriveAccessToRemove(
	ctx: QueryCtx,
	args: { bookingId: Id<"bookings">; editorTokenIdentifier: string }
) {
	return safeTry(async function* () {
		const driveSession = yield* loadDriveSessionRowByBookingId(ctx, args.bookingId);

		return ok(yield* editorDriveAccessToRemoveForSession(ctx, driveSession, args));
	});
}

function loadPendingEditorSessions(
	ctx: QueryCtx,
	retirementRows: Parameters<typeof mergeEditorRetirementSessions>[0]
) {
	const { assignedBookings } = retirementRows;

	return loadDriveSessionsForBookings(ctx, getCompletedEditorBookingIds(assignedBookings)).map(
		(sessions) => mergeEditorRetirementSessions(retirementRows, sessions)
	);
}

export function getEditorRetirementSessions(
	ctx: QueryCtx,
	editorTokenIdentifier: string
): ResultAsync<Doc<"driveSessions">[], DriveEditorPermissionsError> {
	return safeTry(async function* () {
		const retirementRows = yield* listEditorRetirementSessions(ctx, editorTokenIdentifier);

		return ok(yield* loadPendingEditorSessions(ctx, retirementRows));
	});
}

export function getEditorRetirementAssets(
	ctx: QueryCtx,
	editorTokenIdentifier: string
): ResultAsync<RetiredAssetPermission[], DriveEditorPermissionsError> {
	return safeTry(async function* () {
		const permissions = yield* listEditorAssetPermissionsForRetirement(ctx, editorTokenIdentifier);

		return ok(yield* loadEditorRetirementAssetInfos(ctx, permissions));
	});
}

export function clearEditorAssetPermission(
	ctx: MutationCtx,
	args: { permissionId: Id<"driveClientEditorPermissions"> | null; editorTokenIdentifier: string }
): ResultAsync<null, DriveEditorPermissionsError> {
	return safeTry(async function* () {
		const permission = yield* loadEditorAssetPermissionForClear(ctx, args.permissionId);

		return ok(yield* deleteEditorAssetPermissionIfOwned(ctx, permission, args));
	});
}

export function markEditorDriveAccessRevoked(
	ctx: MutationCtx,
	args: { driveSessionId: Id<"driveSessions">; editorTokenIdentifier: string }
) {
	return safeTry(async function* () {
		const driveSession = yield* loadDriveSessionRow(ctx, args.driveSessionId);

		return ok(yield* markEditorDriveAccessRevokedForSession(ctx, driveSession, args));
	});
}

export function clearPreviousEditorDriveAccess(
	ctx: MutationCtx,
	args: {
		driveClientEditorPermissionId: Id<"driveClientEditorPermissions"> | null;
		driveSessionId: Id<"driveSessions">;
		editorTokenIdentifier: string;
		retired: boolean;
	}
) {
	return safeTry(async function* () {
		const session = yield* loadDriveSessionRow(ctx, args.driveSessionId);

		return ok(yield* clearPreviousEditorDriveAccessAndAssetRecord(ctx, args, session));
	});
}

function clearPreviousEditorDriveAccessAndAssetRecord(
	ctx: MutationCtx,
	args: Parameters<typeof clearPreviousEditorDriveAccess>[1],
	driveSession: Doc<"driveSessions"> | null
) {
	return safeTry(async function* () {
		yield* clearPreviousEditorDriveAccessForSession(ctx, driveSession, args);

		return ok(
			yield* clearEditorAssetPermission(ctx, {
				permissionId: args.driveClientEditorPermissionId,
				editorTokenIdentifier: args.editorTokenIdentifier
			})
		);
	});
}

export function markPreviousEditorRemovalFailed(
	ctx: MutationCtx,
	args: { bookingId: Id<"bookings">; editorTokenIdentifier: string }
): ResultAsync<null, DriveEditorPermissionsError> {
	return safeTry(async function* () {
		const driveSession = yield* loadDriveSessionRowByBookingId(ctx, args.bookingId);

		return ok(yield* markPreviousEditorRemovalFailedForSession(ctx, driveSession, args));
	});
}

export function getFailedEditorRemoval(ctx: QueryCtx, bookingId: Id<"bookings">) {
	return safeTry(async function* () {
		const driveSession = yield* loadDriveSessionRowByBookingId(ctx, bookingId);

		return ok(yield* loadFailedEditorRemovalForSession(ctx, bookingId, driveSession));
	});
}

function loadFailedEditorRemovalForSession(
	ctx: QueryCtx,
	bookingId: Id<"bookings">,
	driveSession: Doc<"driveSessions"> | null
) {
	const token = driveSession?.failedRemovalEditorTokenIdentifier;

	return safeTry(async function* () {
		const clientData = yield* loadEditorClientDriveDataWhenAvailable(
			ctx,
			driveSession,
			token ?? null
		);

		const editor = yield* loadEditorProfileByToken(ctx, token ?? null);

		return ok(failedEditorRemovalForSession(driveSession, bookingId, editor, clientData));
	});
}

export function saveEditorDrivePermission(
	ctx: MutationCtx,
	args: {
		bookingId: Id<"bookings">;
		editorTokenIdentifier: string;
		name: "Assets" | "Deliverables" | "Session";
		permission: import("#convex/drive/lib/googleDrive").SavedDrivePermission;
	}
) {
	return safeTry(async function* () {
		const editor = yield* loadEditorProfileByToken(ctx, args.editorTokenIdentifier);
		yield* requireActiveEditor(editor);
		const setup = yield* getDriveSetup(ctx, args.bookingId);
		const context = yield* requireEditorPermissionSetup(setup, args);

		return ok(yield* writeEditorPermissionForValidSetup(ctx, args, context));
	});
}

function writeEditorPermissionForValidSetup(
	ctx: MutationCtx,
	args: Parameters<typeof saveEditorDrivePermission>[1],
	context: EditorPermissionSetupContext
) {
	return safeTry(async function* () {
		const existing = yield* loadEditorAssetsPermission(
			ctx,
			args.name === "Assets"
				? {
						driveClientId: context.driveClientId,
						editorTokenIdentifier: args.editorTokenIdentifier
					}
				: null
		);

		return ok(yield* saveEditorPermissionForSetup(ctx, { ...context, ...args }, existing));
	});
}

export function saveEditorDrivePermissionsStatus(
	ctx: MutationCtx,
	args: { bookingId: Id<"bookings">; editorTokenIdentifier: string; status: "failed" | "ready" }
) {
	return safeTry(async function* () {
		const editor = yield* loadEditorProfileByToken(ctx, args.editorTokenIdentifier);
		yield* requireActiveEditor(editor);
		const setup = yield* getDriveSetup(ctx, args.bookingId);
		const session = yield* requireEditorPermissionStatusSetup(setup, args);

		return ok(yield* writeEditorDrivePermissionsStatus(ctx, session, args));
	});
}

export function claimEditorAssignmentEmail(
	ctx: MutationCtx,
	args: { bookingId: Id<"bookings">; editorTokenIdentifier: string; now: number }
) {
	return safeTry(async function* () {
		const setup = yield* getDriveSetup(ctx, args.bookingId);
		const emailSetup = yield* requireEditorAssignmentEmailSetup(setup, args);
		const editor = yield* loadEditorProfileByToken(ctx, args.editorTokenIdentifier);

		return ok(yield* claimEditorAssignmentEmailForEditor(ctx, emailSetup, args, editor));
	});
}

export function saveEditorAssignmentEmailResult(
	ctx: MutationCtx,
	args: {
		bookingId: Id<"bookings">;
		claimedAt: number;
		editorTokenIdentifier: string;
		status: "failed" | "sent";
	}
) {
	return safeTry(async function* () {
		const driveSession = yield* loadDriveSessionRowByBookingId(ctx, args.bookingId);

		return ok(yield* saveEditorAssignmentEmailResultForSession(ctx, driveSession, args));
	});
}
