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
	return getDriveSetup(ctx, bookingId).andThen(loadEditorDriveSetupFromDriveSetup(ctx));
}

function loadEditorDriveSetupFromDriveSetup(ctx: QueryCtx) {
	return (setup: DriveSetupInfo | null) => {
		const editorTokenIdentifier = setup?.booking.assignedEditorTokenIdentifier;

		if (editorTokenIdentifier === undefined) {
			return editorDriveSetupFromLoaded(setup, null);
		}

		return loadEditorProfileByToken(ctx, editorTokenIdentifier).andThen(
			editorDriveSetupFromLoadedStep(setup)
		);
	};
}

function editorDriveSetupFromLoadedStep(setup: DriveSetupInfo | null) {
	return (editor: Doc<"editorProfiles"> | null) => editorDriveSetupFromLoaded(setup, editor);
}

export function getEditorDriveAccessToRemove(
	ctx: QueryCtx,
	args: { bookingId: Id<"bookings">; editorTokenIdentifier: string }
) {
	return loadDriveSessionRowByBookingId(ctx, args.bookingId).andThen(
		editorDriveAccessToRemoveForLoadedSession(ctx, args)
	);
}

function editorDriveAccessToRemoveForLoadedSession(
	ctx: QueryCtx,
	args: Parameters<typeof getEditorDriveAccessToRemove>[1]
) {
	return (driveSession: Doc<"driveSessions"> | null) =>
		editorDriveAccessToRemoveForSession(ctx, driveSession, args);
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
		clearPreviousEditorDriveAccessForLoadedSession(ctx, args)
	);
}

function clearPreviousEditorDriveAccessForLoadedSession(
	ctx: MutationCtx,
	args: Parameters<typeof clearPreviousEditorDriveAccess>[1]
) {
	return (driveSession: Doc<"driveSessions"> | null) =>
		clearPreviousEditorDriveAccessForSession(ctx, driveSession, args);
}

export function markPreviousEditorRemovalFailed(
	ctx: MutationCtx,
	args: { bookingId: Id<"bookings">; editorTokenIdentifier: string }
) {
	return loadDriveSessionRowByBookingId(ctx, args.bookingId).andThen(
		markPreviousEditorRemovalFailedForLoadedSession(ctx, args)
	);
}

function markPreviousEditorRemovalFailedForLoadedSession(
	ctx: MutationCtx,
	args: Parameters<typeof markPreviousEditorRemovalFailed>[1]
) {
	return (driveSession: Doc<"driveSessions"> | null) =>
		markPreviousEditorRemovalFailedForSession(ctx, driveSession, args);
}

export function getFailedEditorRemoval(ctx: QueryCtx, bookingId: Id<"bookings">) {
	return loadDriveSessionRowByBookingId(ctx, bookingId).andThen(
		loadFailedEditorRemovalForSession(ctx, bookingId)
	);
}

function loadFailedEditorRemovalForSession(ctx: QueryCtx, bookingId: Id<"bookings">) {
	return (driveSession: Doc<"driveSessions"> | null) => {
		const editorTokenIdentifier = driveSession?.failedRemovalEditorTokenIdentifier;

		if (driveSession === null || editorTokenIdentifier === undefined) {
			return okAsync(null);
		}

		return loadEditorClientDriveData(ctx, driveSession, editorTokenIdentifier).andThen(
			loadFailedEditorRemovalWithProfile(ctx, driveSession, bookingId, editorTokenIdentifier)
		);
	};
}

function loadFailedEditorRemovalWithProfile(
	ctx: QueryCtx,
	driveSession: Doc<"driveSessions">,
	bookingId: Id<"bookings">,
	editorTokenIdentifier: string
) {
	return (
		clientData: Awaited<
			ReturnType<typeof loadEditorClientDriveData> extends ResultAsync<infer T, infer _E>
				? T
				: never
		>
	) =>
		loadEditorProfileByToken(ctx, editorTokenIdentifier).map(
			mapFailedEditorRemoval(driveSession, bookingId, clientData)
		);
}

function mapFailedEditorRemoval(
	driveSession: Doc<"driveSessions">,
	bookingId: Id<"bookings">,
	clientData: Parameters<typeof failedEditorRemovalForSession>[3]
) {
	return (editor: Doc<"editorProfiles"> | null) =>
		failedEditorRemovalForSession(driveSession, bookingId, editor, clientData);
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
	return getDriveSetup(ctx, args.bookingId).andThen(writeEditorDrivePermissionFromSetup(ctx, args));
}

function writeEditorDrivePermissionFromSetup(
	ctx: MutationCtx,
	args: Parameters<typeof saveEditorDrivePermission>[1]
) {
	return (setup: DriveSetupInfo | null) => {
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
	};
}

export function saveEditorDrivePermissionsStatus(
	ctx: MutationCtx,
	args: { bookingId: Id<"bookings">; editorTokenIdentifier: string; status: "failed" | "ready" }
) {
	return getDriveSetup(ctx, args.bookingId).andThen(
		writeEditorDrivePermissionsStatusFromSetup(ctx, args)
	);
}

function writeEditorDrivePermissionsStatusFromSetup(
	ctx: MutationCtx,
	args: Parameters<typeof saveEditorDrivePermissionsStatus>[1]
) {
	return (setup: DriveSetupInfo | null) => {
		if (
			setup?.driveSession === null ||
			setup?.driveSession === undefined ||
			setup.booking.assignedEditorTokenIdentifier !== args.editorTokenIdentifier
		) {
			return err({ reason: "DRIVE_RECORD_NOT_FOUND" as const });
		}

		return writeEditorDrivePermissionsStatus(ctx, setup.driveSession, args);
	};
}

export function claimEditorAssignmentEmail(
	ctx: MutationCtx,
	args: { bookingId: Id<"bookings">; editorTokenIdentifier: string; now: number }
) {
	return getDriveSetup(ctx, args.bookingId).andThen(claimEditorAssignmentEmailFromSetup(ctx, args));
}

function claimEditorAssignmentEmailFromSetup(
	ctx: MutationCtx,
	args: Parameters<typeof claimEditorAssignmentEmail>[1]
) {
	return (setup: DriveSetupInfo | null) => {
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
			claimEditorAssignmentEmailForEditorStep(ctx, { ...setup, driveSession }, args)
		);
	};
}

function claimEditorAssignmentEmailForEditorStep(
	ctx: MutationCtx,
	setup: DriveSetupInfo & { driveSession: Doc<"driveSessions"> },
	args: Parameters<typeof claimEditorAssignmentEmail>[1]
) {
	return (editor: Doc<"editorProfiles"> | null) =>
		claimEditorAssignmentEmailForEditor(ctx, setup, args, editor);
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
		saveEditorAssignmentEmailResultForLoadedSession(ctx, args)
	);
}

function saveEditorAssignmentEmailResultForLoadedSession(
	ctx: MutationCtx,
	args: Parameters<typeof saveEditorAssignmentEmailResult>[1]
) {
	return (driveSession: Doc<"driveSessions"> | null) =>
		saveEditorAssignmentEmailResultForSession(ctx, driveSession, args);
}
