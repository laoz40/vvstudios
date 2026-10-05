import { err, okAsync, type ResultAsync } from "neverthrow";
import type { Doc, Id } from "#convex/_generated/dataModel";
import type { MutationCtx, QueryCtx } from "#convex/_generated/server";
import type { DriveSetupInfo } from "#convex/lib/drive/driveLookup";
import {
	claimEditorAssignmentEmailForEditor,
	clearPreviousEditorDriveAccessForSession,
	editorDriveAccessToRemoveForSession,
	editorDriveSetupFromLoaded,
	failedEditorRemovalForSession,
	loadEditorClientDriveData,
	loadEditorProfileByToken,
	markPreviousEditorRemovalFailedForSession,
	saveEditorAssignmentEmailResultForSession,
	writeEditorDrivePermission,
	writeEditorDrivePermissionsStatus
} from "#convex/lib/drive/driveEditor";
import {
	loadDriveSessionRow,
	loadDriveSessionRowByBookingId
} from "#convex/lib/drive/driveBookingDriveClient";
import { getDriveSetup } from "#convex/services/drive/driveSetupQuery";

export function getEditorDriveSetup(ctx: QueryCtx, bookingId: Id<"bookings">) {
	return getDriveSetup(ctx, bookingId).andThen((setup: DriveSetupInfo | null) =>
		loadEditorDriveSetupFromDriveSetup(ctx, setup)
	);
}

function loadEditorDriveSetupFromDriveSetup(ctx: QueryCtx, setup: DriveSetupInfo | null) {
	const editorTokenIdentifier = setup?.booking.assignedEditorTokenIdentifier;

	if (editorTokenIdentifier === undefined) {
		return editorDriveSetupFromLoaded(setup, null);
	}

	return loadEditorProfileByToken(ctx, editorTokenIdentifier).andThen(
		(editor: Doc<"editorProfiles"> | null) => editorDriveSetupFromLoadedStep(setup, editor)
	);
}

function editorDriveSetupFromLoadedStep(
	setup: DriveSetupInfo | null,
	editor: Doc<"editorProfiles"> | null
) {
	return editorDriveSetupFromLoaded(setup, editor);
}

export function getEditorDriveAccessToRemove(
	ctx: QueryCtx,
	args: { bookingId: Id<"bookings">; editorTokenIdentifier: string }
) {
	return loadDriveSessionRowByBookingId(ctx, args.bookingId).andThen(
		(driveSession: Doc<"driveSessions"> | null) =>
			editorDriveAccessToRemoveForLoadedSession(ctx, args, driveSession)
	);
}

function editorDriveAccessToRemoveForLoadedSession(
	ctx: QueryCtx,
	args: Parameters<typeof getEditorDriveAccessToRemove>[1],
	driveSession: Doc<"driveSessions"> | null
) {
	return editorDriveAccessToRemoveForSession(ctx, driveSession, args);
}

export function clearPreviousEditorDriveAccess(
	ctx: MutationCtx,
	args: {
		driveClientEditorPermissionId: Id<"driveClientEditorPermissions"> | null;
		driveSessionId: Id<"driveSessions">;
		editorTokenIdentifier: string;
	}
) {
	return loadDriveSessionRow(ctx, args.driveSessionId).andThen(
		(driveSession: Doc<"driveSessions"> | null) =>
			clearPreviousEditorDriveAccessForLoadedSession(ctx, args, driveSession)
	);
}

function clearPreviousEditorDriveAccessForLoadedSession(
	ctx: MutationCtx,
	args: Parameters<typeof clearPreviousEditorDriveAccess>[1],
	driveSession: Doc<"driveSessions"> | null
) {
	return clearPreviousEditorDriveAccessForSession(ctx, driveSession, args);
}

export function markPreviousEditorRemovalFailed(
	ctx: MutationCtx,
	args: { bookingId: Id<"bookings">; editorTokenIdentifier: string }
) {
	return loadDriveSessionRowByBookingId(ctx, args.bookingId).andThen(
		(driveSession: Doc<"driveSessions"> | null) =>
			markPreviousEditorRemovalFailedForLoadedSession(ctx, args, driveSession)
	);
}

function markPreviousEditorRemovalFailedForLoadedSession(
	ctx: MutationCtx,
	args: Parameters<typeof markPreviousEditorRemovalFailed>[1],
	driveSession: Doc<"driveSessions"> | null
) {
	return markPreviousEditorRemovalFailedForSession(ctx, driveSession, args);
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
	const editorTokenIdentifier = driveSession?.failedRemovalEditorTokenIdentifier;

	if (driveSession === null || editorTokenIdentifier === undefined) {
		return okAsync(null);
	}

	return loadEditorClientDriveData(ctx, driveSession, editorTokenIdentifier).andThen(
		(
			clientData: Awaited<
				ReturnType<typeof loadEditorClientDriveData> extends ResultAsync<infer T, infer _E>
					? T
					: never
			>
		) =>
			loadFailedEditorRemovalWithProfile(
				ctx,
				driveSession,
				bookingId,
				editorTokenIdentifier,
				clientData
			)
	);
}

function loadFailedEditorRemovalWithProfile(
	ctx: QueryCtx,
	driveSession: Doc<"driveSessions">,
	bookingId: Id<"bookings">,
	editorTokenIdentifier: string,
	clientData: Awaited<
		ReturnType<typeof loadEditorClientDriveData> extends ResultAsync<infer T, infer _E> ? T : never
	>
) {
	return loadEditorProfileByToken(ctx, editorTokenIdentifier).map(
		(editor: Doc<"editorProfiles"> | null) =>
			mapFailedEditorRemoval(driveSession, bookingId, clientData, editor)
	);
}

function mapFailedEditorRemoval(
	driveSession: Doc<"driveSessions">,
	bookingId: Id<"bookings">,
	clientData: Parameters<typeof failedEditorRemovalForSession>[3],
	editor: Doc<"editorProfiles"> | null
) {
	return failedEditorRemovalForSession(driveSession, bookingId, editor, clientData);
}

export function saveEditorDrivePermission(
	ctx: MutationCtx,
	args: {
		bookingId: Id<"bookings">;
		editorTokenIdentifier: string;
		name: "Assets" | "Deliverables" | "Session";
		permission: Parameters<typeof writeEditorDrivePermission>[2]["permission"];
	}
) {
	return getDriveSetup(ctx, args.bookingId).andThen((setup: DriveSetupInfo | null) =>
		writeEditorDrivePermissionFromSetup(ctx, args, setup)
	);
}

function writeEditorDrivePermissionFromSetup(
	ctx: MutationCtx,
	args: Parameters<typeof saveEditorDrivePermission>[1],
	setup: DriveSetupInfo | null
) {
	if (
		setup === null ||
		setup.driveClient === null ||
		setup.driveSession === null ||
		setup.booking.assignedEditorTokenIdentifier !== args.editorTokenIdentifier
	) {
		return err({ reason: "DRIVE_RECORD_NOT_FOUND" as const });
	}

	return writeEditorDrivePermission(
		ctx,
		{ driveClient: setup.driveClient, driveSession: setup.driveSession },
		args
	);
}

export function saveEditorDrivePermissionsStatus(
	ctx: MutationCtx,
	args: { bookingId: Id<"bookings">; editorTokenIdentifier: string; status: "failed" | "ready" }
) {
	return getDriveSetup(ctx, args.bookingId).andThen((setup: DriveSetupInfo | null) =>
		writeEditorDrivePermissionsStatusFromSetup(ctx, args, setup)
	);
}

function writeEditorDrivePermissionsStatusFromSetup(
	ctx: MutationCtx,
	args: Parameters<typeof saveEditorDrivePermissionsStatus>[1],
	setup: DriveSetupInfo | null
) {
	if (
		setup?.driveSession === null ||
		setup?.driveSession === undefined ||
		setup.booking.assignedEditorTokenIdentifier !== args.editorTokenIdentifier
	) {
		return err({ reason: "DRIVE_RECORD_NOT_FOUND" as const });
	}

	return writeEditorDrivePermissionsStatus(ctx, setup.driveSession, args);
}

export function claimEditorAssignmentEmail(
	ctx: MutationCtx,
	args: { bookingId: Id<"bookings">; editorTokenIdentifier: string; now: number }
) {
	return getDriveSetup(ctx, args.bookingId).andThen((setup: DriveSetupInfo | null) =>
		claimEditorAssignmentEmailFromSetup(ctx, args, setup)
	);
}

function claimEditorAssignmentEmailFromSetup(
	ctx: MutationCtx,
	args: Parameters<typeof claimEditorAssignmentEmail>[1],
	setup: DriveSetupInfo | null
) {
	if (setup === null) {
		return err({ reason: "EDITOR_ASSIGNMENT_EMAIL_NOT_SENDABLE" as const });
	}

	const driveSession = setup.driveSession;

	if (
		driveSession === null ||
		setup.booking.assignedEditorTokenIdentifier !== args.editorTokenIdentifier ||
		driveSession.editorDrivePermissionsStatus !== "ready" ||
		driveSession.editorDrivePermissionsTokenIdentifier !== args.editorTokenIdentifier
	) {
		return err({ reason: "EDITOR_ASSIGNMENT_EMAIL_NOT_SENDABLE" as const });
	}

	return loadEditorProfileByToken(ctx, args.editorTokenIdentifier).andThen(
		(editor: Doc<"editorProfiles"> | null) =>
			claimEditorAssignmentEmailForEditorStep(ctx, { ...setup, driveSession }, args, editor)
	);
}

function claimEditorAssignmentEmailForEditorStep(
	ctx: MutationCtx,
	setup: DriveSetupInfo & { driveSession: Doc<"driveSessions"> },
	args: Parameters<typeof claimEditorAssignmentEmail>[1],
	editor: Doc<"editorProfiles"> | null
) {
	return claimEditorAssignmentEmailForEditor(ctx, setup, args, editor);
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
			saveEditorAssignmentEmailResultForLoadedSession(ctx, args, driveSession)
	);
}

function saveEditorAssignmentEmailResultForLoadedSession(
	ctx: MutationCtx,
	args: Parameters<typeof saveEditorAssignmentEmailResult>[1],
	driveSession: Doc<"driveSessions"> | null
) {
	return saveEditorAssignmentEmailResultForSession(ctx, driveSession, args);
}
