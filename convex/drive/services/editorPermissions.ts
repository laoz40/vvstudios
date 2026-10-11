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
	mergeEditorRetirementSessions
} from "#convex/drive/lib/editorRetirement";
import {
	loadDriveSessionRow,
	loadDriveSessionRowByBookingId
} from "#convex/drive/lib/driveBookingDriveClient";
import { getDriveSetup } from "#convex/drive/services/driveSetupQuery";
import { requireActiveEditor } from "#convex/editor/lib/editorAssignments";

export function getEditorDriveSetup(ctx: QueryCtx, bookingId: Id<"bookings">) {
	return getDriveSetup(ctx, bookingId).andThen((setup: DriveSetupInfo | null) =>
		loadEditorDriveSetupFromDriveSetup(ctx, setup)
	);
}

function loadEditorDriveSetupFromDriveSetup(ctx: QueryCtx, setup: DriveSetupInfo | null) {
	return loadEditorProfileByToken(
		ctx,
		setup?.booking.assignedEditorTokenIdentifier ?? null
	).andThen((editor) => editorDriveSetupFromLoaded(setup, editor));
}

export function getEditorDriveAccessToRemove(
	ctx: QueryCtx,
	args: { bookingId: Id<"bookings">; editorTokenIdentifier: string }
) {
	return loadDriveSessionRowByBookingId(ctx, args.bookingId).andThen(
		(driveSession: Doc<"driveSessions"> | null) =>
			editorDriveAccessToRemoveForSession(ctx, driveSession, args)
	);
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

export function getEditorRetirementSessions(ctx: QueryCtx, editorTokenIdentifier: string) {
	return listEditorRetirementSessions(ctx, editorTokenIdentifier).andThen((retirementRows) =>
		loadPendingEditorSessions(ctx, retirementRows)
	);
}

export function getEditorRetirementAssets(ctx: QueryCtx, editorTokenIdentifier: string) {
	return listEditorAssetPermissionsForRetirement(ctx, editorTokenIdentifier).andThen(
		(permissions) => loadEditorRetirementAssetInfos(ctx, permissions)
	);
}

export function clearEditorAssetPermission(
	ctx: MutationCtx,
	args: { permissionId: Id<"driveClientEditorPermissions"> | null; editorTokenIdentifier: string }
) {
	return loadEditorAssetPermissionForClear(ctx, args.permissionId).andThen((permission) =>
		deleteEditorAssetPermissionIfOwned(ctx, permission, args)
	);
}

export function markEditorDriveAccessRevoked(
	ctx: MutationCtx,
	args: { driveSessionId: Id<"driveSessions">; editorTokenIdentifier: string }
) {
	return loadDriveSessionRow(ctx, args.driveSessionId).andThen((driveSession) =>
		markEditorDriveAccessRevokedForSession(ctx, driveSession, args)
	);
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
	return loadDriveSessionRow(ctx, args.driveSessionId).andThen((session) =>
		clearPreviousEditorDriveAccessAndAssetRecord(ctx, args, session)
	);
}

function clearPreviousEditorDriveAccessAndAssetRecord(
	ctx: MutationCtx,
	args: Parameters<typeof clearPreviousEditorDriveAccess>[1],
	driveSession: Doc<"driveSessions"> | null
) {
	return clearPreviousEditorDriveAccessForSession(ctx, driveSession, args).andThen(() =>
		clearEditorAssetPermission(ctx, {
			permissionId: args.driveClientEditorPermissionId,
			editorTokenIdentifier: args.editorTokenIdentifier
		})
	);
}

export function markPreviousEditorRemovalFailed(
	ctx: MutationCtx,
	args: { bookingId: Id<"bookings">; editorTokenIdentifier: string }
) {
	return loadDriveSessionRowByBookingId(ctx, args.bookingId).andThen(
		(driveSession: Doc<"driveSessions"> | null) =>
			markPreviousEditorRemovalFailedForSession(ctx, driveSession, args)
	);
}

export function getFailedEditorRemoval(ctx: QueryCtx, bookingId: Id<"bookings">) {
	return loadDriveSessionRowByBookingId(ctx, bookingId).andThen(
		(driveSession: Doc<"driveSessions"> | null) =>
			loadFailedEditorRemovalForSession(ctx, bookingId, driveSession)
	);
}

function loadFailedEditorRemovalForSession(
	ctx: QueryCtx,
	bookingId: Id<"bookings">,
	driveSession: Doc<"driveSessions"> | null
) {
	const token = driveSession?.failedRemovalEditorTokenIdentifier;

	return loadEditorClientDriveDataWhenAvailable(ctx, driveSession, token ?? null).andThen(
		(clientData) =>
			loadEditorProfileByToken(ctx, token ?? null).map((editor) =>
				failedEditorRemovalForSession(driveSession, bookingId, editor, clientData)
			)
	);
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
	return loadEditorProfileByToken(ctx, args.editorTokenIdentifier)
		.andThen(requireActiveEditor)
		.andThen(() => getDriveSetup(ctx, args.bookingId))
		.andThen((setup: DriveSetupInfo | null) => requireEditorPermissionSetup(setup, args))
		.andThen((context) => writeEditorPermissionForValidSetup(ctx, args, context));
}

function writeEditorPermissionForValidSetup(
	ctx: MutationCtx,
	args: Parameters<typeof saveEditorDrivePermission>[1],
	context: EditorPermissionSetupContext
) {
	return loadEditorAssetsPermission(
		ctx,
		args.name === "Assets"
			? { driveClientId: context.driveClientId, editorTokenIdentifier: args.editorTokenIdentifier }
			: null
	).andThen((existing) => saveEditorPermissionForSetup(ctx, { ...context, ...args }, existing));
}

export function saveEditorDrivePermissionsStatus(
	ctx: MutationCtx,
	args: { bookingId: Id<"bookings">; editorTokenIdentifier: string; status: "failed" | "ready" }
) {
	return loadEditorProfileByToken(ctx, args.editorTokenIdentifier)
		.andThen(requireActiveEditor)
		.andThen(() => getDriveSetup(ctx, args.bookingId))
		.andThen((setup: DriveSetupInfo | null) => requireEditorPermissionStatusSetup(setup, args))
		.andThen((session) => writeEditorDrivePermissionsStatus(ctx, session, args));
}

export function claimEditorAssignmentEmail(
	ctx: MutationCtx,
	args: { bookingId: Id<"bookings">; editorTokenIdentifier: string; now: number }
) {
	return getDriveSetup(ctx, args.bookingId)
		.andThen((setup) => requireEditorAssignmentEmailSetup(setup, args))
		.andThen((setup) =>
			loadEditorProfileByToken(ctx, args.editorTokenIdentifier).andThen((editor) =>
				claimEditorAssignmentEmailForEditor(ctx, setup, args, editor)
			)
		);
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
	return loadDriveSessionRowByBookingId(ctx, args.bookingId).andThen(
		(driveSession: Doc<"driveSessions"> | null) =>
			saveEditorAssignmentEmailResultForSession(ctx, driveSession, args)
	);
}
