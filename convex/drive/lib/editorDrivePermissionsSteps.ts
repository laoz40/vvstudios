"use node";

import { errAsync, ok, okAsync, type ResultAsync, type Result, err } from "neverthrow";
import { internal } from "#convex/_generated/api";
import type { Id } from "#convex/_generated/dataModel";
import type { ActionCtx } from "#convex/_generated/server";
import {
	getEditorPermissionFolder,
	type EditorDriveAccessToRemove,
	type EditorDriveSetupRecord,
	type FailedEditorRemoval
} from "#convex/drive/lib/driveEditor";
import type { DriveSetupInfo } from "#convex/drive/lib/sessionFolders/driveSetupInfo";

import type { DriveError, SavedDrivePermission } from "#convex/drive/lib/googleDrive";

import { fromConvexTuple } from "#convex/shared/lib/result";

export type DriveEditorPermissionsError =
	| DriveError
	| { reason: "BOOKING_NOT_FOUND" | "EDITOR_NOT_ASSIGNED" | "EDITOR_NOT_ACTIVE" }
	| { reason: "DRIVE_FOLDERS_NOT_READY" | "DRIVE_RECORD_NOT_FOUND" }
	| {
			reason:
				| "EDITOR_ASSIGNMENT_EMAIL_NOT_SENDABLE"
				| "EMAIL_RENDER_FAILED"
				| "EMAIL_REQUEST_FAILED"
				| "EMAIL_RESPONSE_FAILED";
	  }
	| { reason: "PREVIOUS_EDITOR_REMOVAL_NOT_FOUND" };

export type EditorPermissionRequirement = { fileId: string; role: "reader" | "writer" };

type EditorAssignmentEmailClaim = {
	bookingId: Id<"bookings">;
	claimedAt: number;
	editorEmail: string;
	editorName: string;
	editorTokenIdentifier: string;
	sessionName: string;
	sessionStartAt: number;
	editorDueDate?: string;
};

export function loadEditorDriveSetup(
	ctx: ActionCtx,
	bookingId: Id<"bookings">
): ResultAsync<EditorDriveSetupRecord, DriveEditorPermissionsError> {
	return fromConvexTuple(ctx.runQuery(internal.sessions.drive.getEditorDriveSetup, { bookingId }));
}

export function saveEditorPermissionsStatus(
	ctx: ActionCtx,
	setup: EditorDriveSetupRecord,
	status: "failed" | "ready"
) {
	return fromConvexTuple(
		ctx.runMutation(internal.sessions.drive.saveEditorDrivePermissionsStatus, {
			bookingId: setup.booking._id,
			editorTokenIdentifier: setup.editor.tokenIdentifier,
			status
		})
	);
}

export function markEditorPermissionsReady(ctx: ActionCtx, setup: EditorDriveSetupRecord) {
	return saveEditorPermissionsStatus(ctx, setup, "ready");
}

export function writeEditorPermissionsReady(ctx: ActionCtx, setup: EditorDriveSetupRecord) {
	return markEditorPermissionsReady(ctx, setup);
}

export function saveSentEditorAssignmentEmailResult(
	ctx: ActionCtx,
	claim: EditorAssignmentEmailClaim
) {
	return fromConvexTuple(
		ctx.runMutation(internal.sessions.drive.saveEditorAssignmentEmailResult, {
			bookingId: claim.bookingId,
			claimedAt: claim.claimedAt,
			editorTokenIdentifier: claim.editorTokenIdentifier,
			status: "sent"
		})
	);
}

export function saveFailedEditorAssignmentEmailResult(
	ctx: ActionCtx,
	claim: EditorAssignmentEmailClaim
) {
	return fromConvexTuple(
		ctx.runMutation(internal.sessions.drive.saveEditorAssignmentEmailResult, {
			bookingId: claim.bookingId,
			claimedAt: claim.claimedAt,
			editorTokenIdentifier: claim.editorTokenIdentifier,
			status: "failed"
		})
	);
}

export function saveSentEditorAssignmentEmailAfterSend(
	ctx: ActionCtx,
	claim: EditorAssignmentEmailClaim
) {
	return saveSentEditorAssignmentEmailResult(ctx, claim);
}

export function ignoreNonSendableEditorAssignmentEmail(error: DriveEditorPermissionsError) {
	return error.reason === "EDITOR_ASSIGNMENT_EMAIL_NOT_SENDABLE" ? okAsync(null) : errAsync(error);
}

export function clearPreviousEditorDriveAccessRecord(
	ctx: ActionCtx,
	access: EditorDriveAccessToRemove,
	previousEditorTokenIdentifier: string
) {
	return fromConvexTuple(
		ctx.runMutation(internal.sessions.drive.clearPreviousEditorDriveAccess, {
			driveClientEditorPermissionId: access.driveClientEditorPermissionId,
			driveSessionId: access.driveSessionId,
			editorTokenIdentifier: previousEditorTokenIdentifier,
			retired: access.editorRetired
		})
	);
}

export function writePreviousEditorDriveAccessCleared(
	ctx: ActionCtx,
	access: EditorDriveAccessToRemove | null,
	previousEditorTokenIdentifier: string
) {
	if (access === null) {
		return okAsync(null);
	}

	return clearPreviousEditorDriveAccessRecord(ctx, access, previousEditorTokenIdentifier);
}

export function clearFailedEditorDriveAccessRecord(
	ctx: ActionCtx,
	removal: FailedEditorRemoval | null
) {
	if (removal === null) {
		return okAsync(null);
	}

	return fromConvexTuple(
		ctx.runMutation(internal.sessions.drive.clearPreviousEditorDriveAccess, {
			driveClientEditorPermissionId: removal.driveClientEditorPermissionId,
			driveSessionId: removal.driveSessionId,
			editorTokenIdentifier: removal.editorTokenIdentifier,
			retired: removal.editorRetired
		})
	);
}

export function clearFailedEditorDriveAccess(ctx: ActionCtx, removal: FailedEditorRemoval | null) {
	return clearFailedEditorDriveAccessRecord(ctx, removal);
}

export function queryEditorAccessToRemove(
	ctx: ActionCtx,
	args: { bookingId: Id<"bookings">; editorTokenIdentifier: string } | null
) {
	if (args === null) {
		return okAsync(null);
	}

	return fromConvexTuple(ctx.runQuery(internal.sessions.drive.getEditorDriveAccessToRemove, args));
}

export function writePreviousEditorRemovalFailed(
	ctx: ActionCtx,
	args: { bookingId: Id<"bookings">; editorTokenIdentifier: string }
) {
	return fromConvexTuple(
		ctx.runMutation(internal.sessions.drive.markPreviousEditorRemovalFailed, args)
	);
}

export function queryFailedEditorRemoval(
	ctx: ActionCtx,
	args: { bookingId: Id<"bookings"> } | null
) {
	if (args === null) {
		return okAsync(null);
	}

	return fromConvexTuple(ctx.runQuery(internal.sessions.drive.getFailedEditorRemoval, args));
}

export function requireFailedEditorRemoval(
	args: { bookingId: Id<"bookings"> } | null,
	removal: FailedEditorRemoval | null
): Result<FailedEditorRemoval | null, DriveEditorPermissionsError> {
	if (args === null) {
		return ok(null);
	}

	return removal === null ? err({ reason: "PREVIOUS_EDITOR_REMOVAL_NOT_FOUND" }) : ok(removal);
}

export function writeEditorPermission(
	ctx: ActionCtx,
	setup: EditorDriveSetupRecord,
	name: "Assets" | "Deliverables" | "Session",
	permission: SavedDrivePermission
) {
	return fromConvexTuple(
		ctx.runMutation(internal.sessions.drive.saveEditorDrivePermission, {
			bookingId: setup.booking._id,
			editorTokenIdentifier: setup.editor.tokenIdentifier,
			name,
			permission
		})
	);
}

export function claimEditorEmail(ctx: ActionCtx, setup: EditorDriveSetupRecord) {
	return fromConvexTuple(
		ctx.runMutation(internal.sessions.drive.claimEditorAssignmentEmail, {
			bookingId: setup.booking._id,
			editorTokenIdentifier: setup.editor.tokenIdentifier,
			now: Date.now()
		})
	);
}

export function queryOptionalEditorSetup(ctx: ActionCtx, args: { bookingId: Id<"bookings"> }) {
	return fromConvexTuple(
		ctx.runQuery(internal.sessions.drive.getDriveSetup, { bookingId: args.bookingId })
	);
}

export function selectBookingsForEditorAccessSetup(
	setup: DriveSetupInfo | null
): Result<Id<"bookings">[], DriveEditorPermissionsError> {
	if (setup === null) {
		return err({ reason: "BOOKING_NOT_FOUND" });
	}

	return setup.booking.assignedEditorTokenIdentifier === undefined
		? ok([])
		: ok([setup.booking._id]);
}

export function requireEditorFolder(
	setup: EditorDriveSetupRecord,
	name: "Assets" | "Deliverables" | "Session"
): Result<EditorPermissionRequirement, { reason: "DRIVE_FOLDERS_NOT_READY" }> {
	const folder = getEditorPermissionFolder(setup, name);

	return folder === undefined
		? err({ reason: "DRIVE_FOLDERS_NOT_READY" })
		: ok({ fileId: folder.id, role: name === "Deliverables" ? "writer" : "reader" });
}

export function requireEditorFolders(
	setup: EditorDriveSetupRecord
): Result<null, { reason: "DRIVE_FOLDERS_NOT_READY" }> {
	return setup.driveSession.sessionFolder === undefined ||
		setup.driveClient.assetsFolder === undefined ||
		setup.driveSession.deliverablesFolder === undefined
		? err({ reason: "DRIVE_FOLDERS_NOT_READY" })
		: ok(null);
}
