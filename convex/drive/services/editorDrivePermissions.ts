"use node";

import {
	queryEditorAccessToRemove,
	writePreviousEditorRemovalFailed,
	queryFailedEditorRemoval,
	writeEditorPermission,
	claimEditorEmail,
	queryOptionalEditorSetup,
	selectBookingsForEditorAccessSetup,
	requireEditorFolder,
	requireEditorFolders,
	writeEditorPermissionsReady,
	saveEditorPermissionsStatus,
	saveFailedEditorAssignmentEmailResult,
	saveSentEditorAssignmentEmailAfterSend,
	ignoreNonSendableEditorAssignmentEmail,
	writePreviousEditorDriveAccessCleared,
	clearFailedEditorDriveAccess,
	loadEditorDriveSetup
} from "#convex/drive/lib/editorDrivePermissionsSteps";

import { errAsync, ResultAsync } from "neverthrow";

import type { Id } from "#convex/_generated/dataModel";
import type { ActionCtx } from "#convex/_generated/server";
import {
	type EditorDriveAccessToRemove,
	type EditorDriveSetupRecord,
	type FailedEditorRemoval
} from "#convex/drive/lib/driveEditor";
import {
	editorPermissionCleanupFolder,
	loadEditorDriveClientForRemoval,
	loadEditorDriveClientForUnsavedPermission
} from "#convex/drive/lib/editorDrivePermissionIo";
import { sendEditorAssignmentEmail } from "#convex/email/services/templateEmails";
import {
	createDrivePermissionIfMissingRequest,
	deleteDrivePermissionRequest,
	findDrivePermissionRequest,
	ignoreMissingDrivePermission,
	loadDriveClient,
	normalizeDriveEmail,
	parseDrivePermissionResponse,
	parseDrivePermissionListForRemoval,
	type DriveClient,
	type DriveError,
	type SavedDrivePermission
} from "#convex/drive/lib/googleDrive";

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

type EditorPermissionRequirement = { fileId: string; role: "reader" | "writer" };

export function loadEditorDriveAccessToRemove(
	ctx: ActionCtx,
	args: { bookingId: Id<"bookings">; editorTokenIdentifier: string } | null
): ResultAsync<EditorDriveAccessToRemove | null, DriveEditorPermissionsError> {
	return queryEditorAccessToRemove(ctx, args);
}

export function markPreviousEditorRemovalFailed(
	ctx: ActionCtx,
	args: { bookingId: Id<"bookings">; editorTokenIdentifier: string }
): ResultAsync<null, DriveEditorPermissionsError> {
	return writePreviousEditorRemovalFailed(ctx, args);
}

export function loadFailedEditorRemoval(
	ctx: ActionCtx,
	args: { bookingId: Id<"bookings"> } | null
): ResultAsync<FailedEditorRemoval | null, DriveEditorPermissionsError> {
	return queryFailedEditorRemoval(ctx, args);
}

function requireEditorPermission(
	drive: DriveClient,
	editorEmail: string,
	requirement: EditorPermissionRequirement
) {
	const input = {
		email: normalizeDriveEmail(editorEmail),
		fileId: requirement.fileId,
		role: requirement.role
	};

	return findDrivePermissionRequest(drive, input)
		.andThen((response) => parseDrivePermissionListForRemoval(response, input))
		.andThen((existing) =>
			createDrivePermissionIfMissingRequest(
				drive,
				{
					email: normalizeDriveEmail(editorEmail),
					fileId: requirement.fileId,
					role: requirement.role,
					sendNotificationEmail: false
				},
				existing
			)
		)
		.andThen(parseDrivePermissionResponse);
}

function saveEditorPermission(
	ctx: ActionCtx,
	setup: EditorDriveSetupRecord,
	name: "Assets" | "Deliverables" | "Session",
	permission: SavedDrivePermission
) {
	return writeEditorPermission(ctx, setup, name, permission).orElse((error) =>
		removeUnsavedEditorPermission(ctx, setup, name, permission, error)
	);
}

function removeUnsavedEditorPermission(
	ctx: ActionCtx,
	setup: EditorDriveSetupRecord,
	name: "Assets" | "Deliverables" | "Session",
	permission: SavedDrivePermission,
	error: DriveEditorPermissionsError
): ResultAsync<never, DriveEditorPermissionsError> {
	return cleanupUnsavedEditorPermission(
		ctx,
		setup,
		editorPermissionCleanupFolder(setup, name, error),
		permission,
		error
	);
}

function applyEditorDrivePermissionsForDrive(
	ctx: ActionCtx,
	setup: EditorDriveSetupRecord,
	drive: DriveClient
) {
	return requireEditorFolder(setup, "Session")
		.asyncAndThen((requirement) => requireEditorPermission(drive, setup.editor.email, requirement))
		.andThen((permission) => saveEditorPermission(ctx, setup, "Session", permission))
		.andThen(() => requireEditorFolder(setup, "Assets"))
		.andThen((requirement) => requireEditorPermission(drive, setup.editor.email, requirement))
		.andThen((permission) => saveEditorPermission(ctx, setup, "Assets", permission))
		.andThen(() => requireEditorFolder(setup, "Deliverables"))
		.andThen((requirement) => requireEditorPermission(drive, setup.editor.email, requirement))
		.andThen((permission) => saveEditorPermission(ctx, setup, "Deliverables", permission));
}

function ensureEditorDrivePermissions(
	ctx: ActionCtx,
	setup: EditorDriveSetupRecord
): ResultAsync<null, DriveEditorPermissionsError> {
	return requireEditorFolders(setup)
		.asyncAndThen(loadDriveClient)
		.andThen((drive) => applyEditorDrivePermissionsForDrive(ctx, setup, drive))
		.andThen(() => writeEditorPermissionsReady(ctx, setup))
		.map(() => null);
}

type EditorAssignmentEmailClaim = {
	bookingId: Id<"bookings">;
	claimedAt: number;
	editorEmail: string;
	editorName: string;
	editorTokenIdentifier: string;
	sessionName: string;
	sessionStartAt: number;
};

function sendClaimedEditorAssignmentEmail(ctx: ActionCtx, claim: EditorAssignmentEmailClaim) {
	return sendEditorAssignmentEmail({
		editorEmail: claim.editorEmail,
		editorName: claim.editorName,
		sessionName: claim.sessionName,
		sessionStartAt: claim.sessionStartAt
	})
		.andThen(() => saveSentEditorAssignmentEmailAfterSend(ctx, claim))
		.orElse((error) => recordFailedEditorAssignmentEmail(ctx, claim, error));
}

function recordFailedEditorAssignmentEmail(
	ctx: ActionCtx,
	claim: EditorAssignmentEmailClaim,
	emailError: DriveEditorPermissionsError
) {
	return saveFailedEditorAssignmentEmailResult(ctx, claim).andThen(() => errAsync(emailError));
}

export function sendEditorAssignmentEmailForReadyAccess(
	ctx: ActionCtx,
	args: { bookingId: Id<"bookings"> }
): ResultAsync<null, DriveEditorPermissionsError> {
	return loadEditorDriveSetup(ctx, args.bookingId)
		.andThen((setup: EditorDriveSetupRecord) =>
			claimEditorEmail(ctx, setup).andThen((claim) => sendClaimedEditorAssignmentEmail(ctx, claim))
		)
		.orElse(ignoreNonSendableEditorAssignmentEmail);
}

function recordEditorPermissionFailure(
	ctx: ActionCtx,
	setup: EditorDriveSetupRecord,
	error: DriveEditorPermissionsError
) {
	return saveEditorPermissionsStatus(ctx, setup, "failed").andThen(() => errAsync(error));
}

function ensureEditorDrivePermissionsForSetup(ctx: ActionCtx, setup: EditorDriveSetupRecord) {
	return ensureEditorDrivePermissions(ctx, setup)
		.orElse((error: DriveEditorPermissionsError) =>
			recordEditorPermissionFailure(ctx, setup, error)
		)
		.map(() => setup);
}

export function setupEditorAccess(
	ctx: ActionCtx,
	args: { bookingId: Id<"bookings"> }
): ResultAsync<null, DriveEditorPermissionsError> {
	return loadEditorDriveSetup(ctx, args.bookingId)
		.andThen((setup: EditorDriveSetupRecord) => ensureEditorDrivePermissionsForSetup(ctx, setup))
		.andThen((setup: EditorDriveSetupRecord) =>
			claimEditorEmail(ctx, setup).andThen((claim) => sendClaimedEditorAssignmentEmail(ctx, claim))
		);
}

export function setupEditorAccessIfAssigned(
	ctx: ActionCtx,
	args: { bookingId: Id<"bookings"> }
): ResultAsync<null, DriveEditorPermissionsError> {
	return queryOptionalEditorSetup(ctx, args)
		.andThen(selectBookingsForEditorAccessSetup)
		.andThen((bookingIds) =>
			ResultAsync.combine(bookingIds.map((bookingId) => setupEditorAccess(ctx, { bookingId }))).map(
				() => null
			)
		);
}

function removeSavedPermission(
	drive: DriveClient | null,
	fileId: string | null,
	permission: SavedDrivePermission | null
) {
	return deleteDrivePermissionRequest(
		drive,
		fileId === null || permission === null ? null : { fileId, permissionId: permission.id }
	).orElse(ignoreMissingDrivePermission);
}

function revokePreviousEditorDrivePermissions(
	drive: DriveClient | null,
	access: EditorDriveAccessToRemove | null
) {
	return removeSavedPermission(
		drive,
		access?.sessionFolderId ?? null,
		access?.sessionPermission ?? null
	)
		.andThen(() =>
			removeSavedPermission(
				drive,
				access?.deliverablesFolderId ?? null,
				access?.deliverablesPermission ?? null
			)
		)
		.andThen(() =>
			removeSavedPermission(drive, access?.assetsFolderId ?? null, access?.assetsPermission ?? null)
		);
}

export function removePreviousEditorDriveAccess(
	ctx: ActionCtx,
	args: { access: EditorDriveAccessToRemove | null; previousEditorTokenIdentifier: string }
): ResultAsync<null, DriveEditorPermissionsError> {
	return loadEditorDriveClientForRemoval(args.access)
		.andThen((drive) => revokePreviousEditorDrivePermissions(drive, args.access))
		.andThen(() =>
			writePreviousEditorDriveAccessCleared(ctx, args.access, args.previousEditorTokenIdentifier)
		);
}

function revokeFailedEditorDrivePermissions(
	drive: DriveClient | null,
	removal: FailedEditorRemoval | null
) {
	return findAndDeleteEditorPermission(
		drive,
		removal?.sessionFolderId ?? null,
		removal?.editorEmail ?? "",
		"reader"
	)
		.andThen(() =>
			findAndDeleteEditorPermission(
				drive,
				removal?.deliverablesFolderId ?? null,
				removal?.editorEmail ?? "",
				"writer"
			)
		)
		.andThen(() =>
			findAndDeleteEditorPermission(
				drive,
				removal?.assetsFolderId ?? null,
				removal?.editorEmail ?? "",
				"reader"
			)
		);
}

export function removeFailedEditorDriveAccess(
	ctx: ActionCtx,
	removal: FailedEditorRemoval | null
): ResultAsync<null, DriveEditorPermissionsError> {
	return loadEditorDriveClientForRemoval(removal)
		.andThen((drive) => revokeFailedEditorDrivePermissions(drive, removal))
		.andThen(() => clearFailedEditorDriveAccess(ctx, removal));
}

function findAndDeleteEditorPermission(
	drive: DriveClient | null,
	fileId: string | null,
	editorEmail: string,
	role: "reader" | "writer"
) {
	return findDrivePermissionRequest(drive, {
		email: normalizeDriveEmail(editorEmail),
		fileId,
		role
	})
		.andThen((response) =>
			parseDrivePermissionListForRemoval(response, {
				email: normalizeDriveEmail(editorEmail),
				fileId,
				role
			})
		)
		.andThen((permission) =>
			deleteDrivePermissionRequest(
				drive,
				fileId === null || permission === null ? null : { fileId, permissionId: permission.id }
			).orElse(ignoreMissingDrivePermission)
		);
}

// Retirement may happen while Google creates the permission; remove that access before returning the save error.
function cleanupUnsavedEditorPermission(
	ctx: ActionCtx,
	setup: EditorDriveSetupRecord,
	fileId: string | null,
	permission: SavedDrivePermission,
	error: DriveEditorPermissionsError
) {
	return loadEditorDriveClientForUnsavedPermission(fileId)
		.andThen((drive) =>
			deleteDrivePermissionRequest(
				drive,
				fileId === null ? null : { fileId, permissionId: permission.id }
			).orElse(ignoreMissingDrivePermission)
		)
		.orElse((removalError) =>
			markPreviousEditorRemovalFailed(ctx, {
				bookingId: setup.booking._id,
				editorTokenIdentifier: setup.editor.tokenIdentifier
			}).andThen(() => errAsync(removalError))
		)
		.andThen(() => errAsync(error));
}
