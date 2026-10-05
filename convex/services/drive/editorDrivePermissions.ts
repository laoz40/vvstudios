"use node";

import { errAsync, ok, okAsync, type ResultAsync } from "neverthrow";
import { internal } from "#convex/_generated/api";
import type { Id } from "#convex/_generated/dataModel";
import type { ActionCtx } from "#convex/_generated/server";
import type {
	EditorDriveAccessToRemove,
	EditorDriveSetupRecord,
	FailedEditorRemoval
} from "#convex/lib/drive/driveEditor";
import type { DriveSetupInfo } from "#convex/lib/drive/sessionFolders/driveSetupInfo";
import { sendEditorAssignmentEmail } from "#convex/services/email/templateEmails";
import {
	createDrivePermission,
	deleteDrivePermission,
	findDrivePermission,
	loadDriveClient,
	normalizeDriveEmail,
	type DriveClient,
	type DriveError,
	type SavedDrivePermission
} from "#convex/lib/drive/googleDrive";
import { fromConvexTuple } from "#convex/lib/result";

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

function returnNull(): null {
	return null;
}

function returnSetup(setup: EditorDriveSetupRecord) {
	return () => setup;
}

export function loadEditorDriveAccessToRemove(
	ctx: ActionCtx,
	args: { bookingId: Id<"bookings">; editorTokenIdentifier: string }
): ResultAsync<EditorDriveAccessToRemove | null, DriveEditorPermissionsError> {
	return fromConvexTuple(
		ctx.runQuery(internal.sessionsDriveInternal.getEditorDriveAccessToRemove, args)
	);
}

export function markPreviousEditorRemovalFailed(
	ctx: ActionCtx,
	args: { bookingId: Id<"bookings">; editorTokenIdentifier: string }
): ResultAsync<null, DriveEditorPermissionsError> {
	return fromConvexTuple(
		ctx.runMutation(internal.sessionsDriveInternal.markPreviousEditorRemovalFailed, args)
	);
}

export function loadFailedEditorRemoval(
	ctx: ActionCtx,
	args: { bookingId: Id<"bookings"> }
): ResultAsync<FailedEditorRemoval | null, DriveEditorPermissionsError> {
	return fromConvexTuple(ctx.runQuery(internal.sessionsDriveInternal.getFailedEditorRemoval, args));
}

function loadEditorDriveSetup(
	ctx: ActionCtx,
	bookingId: Id<"bookings">
): ResultAsync<EditorDriveSetupRecord, DriveEditorPermissionsError> {
	return fromConvexTuple(
		ctx.runQuery(internal.sessionsDriveInternal.getEditorDriveSetup, { bookingId })
	);
}

function createEditorPermissionWhenMissing(
	drive: DriveClient,
	editorEmail: string,
	requirement: EditorPermissionRequirement
) {
	return (existingPermission: SavedDrivePermission | null) => {
		if (existingPermission !== null) return ok(existingPermission);

		return createDrivePermission(drive, {
			email: normalizeDriveEmail(editorEmail),
			fileId: requirement.fileId,
			role: requirement.role,
			sendNotificationEmail: false
		});
	};
}

function requireEditorPermission(
	drive: DriveClient,
	editorEmail: string,
	requirement: EditorPermissionRequirement
) {
	return findDrivePermission(drive, {
		email: normalizeDriveEmail(editorEmail),
		fileId: requirement.fileId,
		role: requirement.role
	}).andThen(createEditorPermissionWhenMissing(drive, editorEmail, requirement));
}

function saveEditorPermission(
	ctx: ActionCtx,
	setup: EditorDriveSetupRecord,
	name: "Assets" | "Deliverables" | "Session",
	permission: SavedDrivePermission
) {
	return fromConvexTuple(
		ctx.runMutation(internal.sessionsDriveInternal.saveEditorDrivePermission, {
			bookingId: setup.booking._id,
			editorTokenIdentifier: setup.editor.tokenIdentifier,
			name,
			permission
		})
	);
}

function saveEditorPermissionsStatus(
	ctx: ActionCtx,
	setup: EditorDriveSetupRecord,
	status: "failed" | "ready"
) {
	return fromConvexTuple(
		ctx.runMutation(internal.sessionsDriveInternal.saveEditorDrivePermissionsStatus, {
			bookingId: setup.booking._id,
			editorTokenIdentifier: setup.editor.tokenIdentifier,
			status
		})
	);
}

function saveSessionEditorPermission(ctx: ActionCtx, setup: EditorDriveSetupRecord) {
	return (permission: SavedDrivePermission) =>
		saveEditorPermission(ctx, setup, "Session", permission);
}

function requireAssetsEditorPermission(drive: DriveClient, setup: EditorDriveSetupRecord) {
	const assetsFolder = setup.driveClient.assetsFolder;

	if (assetsFolder === undefined) {
		return errAsync({ reason: "DRIVE_FOLDERS_NOT_READY" as const });
	}

	return requireEditorPermission(drive, setup.editor.email, {
		fileId: assetsFolder.id,
		role: "reader"
	});
}

function saveAssetsEditorPermission(ctx: ActionCtx, setup: EditorDriveSetupRecord) {
	return (permission: SavedDrivePermission) =>
		saveEditorPermission(ctx, setup, "Assets", permission);
}

function requireAssetsEditorPermissionStep(drive: DriveClient, setup: EditorDriveSetupRecord) {
	return () => requireAssetsEditorPermission(drive, setup);
}

function requireDeliverablesEditorPermission(drive: DriveClient, setup: EditorDriveSetupRecord) {
	const deliverablesFolder = setup.driveSession.deliverablesFolder;

	if (deliverablesFolder === undefined) {
		return errAsync({ reason: "DRIVE_FOLDERS_NOT_READY" as const });
	}

	return requireEditorPermission(drive, setup.editor.email, {
		fileId: deliverablesFolder.id,
		role: "writer"
	});
}

function saveDeliverablesEditorPermission(ctx: ActionCtx, setup: EditorDriveSetupRecord) {
	return (permission: SavedDrivePermission) =>
		saveEditorPermission(ctx, setup, "Deliverables", permission);
}

function requireDeliverablesEditorPermissionStep(
	drive: DriveClient,
	setup: EditorDriveSetupRecord
) {
	return () => requireDeliverablesEditorPermission(drive, setup);
}

function markEditorPermissionsReady(ctx: ActionCtx, setup: EditorDriveSetupRecord) {
	return saveEditorPermissionsStatus(ctx, setup, "ready");
}

function applyEditorDrivePermissionsForDrive(ctx: ActionCtx, setup: EditorDriveSetupRecord) {
	return (drive: DriveClient) => {
		const sessionFolder = setup.driveSession.sessionFolder;

		if (sessionFolder === undefined) {
			return errAsync({ reason: "DRIVE_FOLDERS_NOT_READY" as const });
		}

		return requireEditorPermission(drive, setup.editor.email, {
			fileId: sessionFolder.id,
			role: "reader"
		})
			.andThen(saveSessionEditorPermission(ctx, setup))
			.andThen(requireAssetsEditorPermissionStep(drive, setup))
			.andThen(saveAssetsEditorPermission(ctx, setup))
			.andThen(requireDeliverablesEditorPermissionStep(drive, setup))
			.andThen(saveDeliverablesEditorPermission(ctx, setup));
	};
}

function ensureEditorDrivePermissions(
	ctx: ActionCtx,
	setup: EditorDriveSetupRecord
): ResultAsync<null, DriveEditorPermissionsError> {
	const assetsFolder = setup.driveClient.assetsFolder;
	const deliverablesFolder = setup.driveSession.deliverablesFolder;
	const sessionFolder = setup.driveSession.sessionFolder;

	if (
		sessionFolder === undefined ||
		assetsFolder === undefined ||
		deliverablesFolder === undefined
	) {
		return errAsync({ reason: "DRIVE_FOLDERS_NOT_READY" as const });
	}

	return loadDriveClient()
		.andThen(applyEditorDrivePermissionsForDrive(ctx, setup))
		.andThen(markEditorPermissionsReadyStep(ctx, setup))
		.map(returnNull);
}

function markEditorPermissionsReadyStep(ctx: ActionCtx, setup: EditorDriveSetupRecord) {
	return () => markEditorPermissionsReady(ctx, setup);
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

function saveSentEditorAssignmentEmailResult(ctx: ActionCtx, claim: EditorAssignmentEmailClaim) {
	return fromConvexTuple(
		ctx.runMutation(internal.sessionsDriveInternal.saveEditorAssignmentEmailResult, {
			bookingId: claim.bookingId,
			claimedAt: claim.claimedAt,
			editorTokenIdentifier: claim.editorTokenIdentifier,
			status: "sent"
		})
	);
}

function saveFailedEditorAssignmentEmailResult(ctx: ActionCtx, claim: EditorAssignmentEmailClaim) {
	return fromConvexTuple(
		ctx.runMutation(internal.sessionsDriveInternal.saveEditorAssignmentEmailResult, {
			bookingId: claim.bookingId,
			claimedAt: claim.claimedAt,
			editorTokenIdentifier: claim.editorTokenIdentifier,
			status: "failed"
		})
	);
}

function rethrowEditorEmailError(error: DriveEditorPermissionsError) {
	return () => errAsync(error);
}

function sendClaimedEditorAssignmentEmail(ctx: ActionCtx, claim: EditorAssignmentEmailClaim) {
	return sendEditorAssignmentEmail({
		editorEmail: claim.editorEmail,
		editorName: claim.editorName,
		sessionName: claim.sessionName,
		sessionStartAt: claim.sessionStartAt
	})
		.andThen(saveSentEditorAssignmentEmailAfterSend(ctx, claim))
		.orElse(recordFailedEditorAssignmentEmail(ctx, claim));
}

function saveSentEditorAssignmentEmailAfterSend(ctx: ActionCtx, claim: EditorAssignmentEmailClaim) {
	return () => saveSentEditorAssignmentEmailResult(ctx, claim);
}

function recordFailedEditorAssignmentEmail(ctx: ActionCtx, claim: EditorAssignmentEmailClaim) {
	return (emailError: DriveEditorPermissionsError) =>
		saveFailedEditorAssignmentEmailResult(ctx, claim).andThen(rethrowEditorEmailError(emailError));
}

function claimAndSendEditorAssignmentEmail(ctx: ActionCtx, setup: EditorDriveSetupRecord) {
	return fromConvexTuple(
		ctx.runMutation(internal.sessionsDriveInternal.claimEditorAssignmentEmail, {
			bookingId: setup.booking._id,
			editorTokenIdentifier: setup.editor.tokenIdentifier,
			now: Date.now()
		})
	).andThen(sendClaimedEditorAssignmentEmailStep(ctx));
}

function sendClaimedEditorAssignmentEmailStep(ctx: ActionCtx) {
	return (claim: EditorAssignmentEmailClaim) => sendClaimedEditorAssignmentEmail(ctx, claim);
}

function sendEditorAssignmentEmailForSetup(ctx: ActionCtx) {
	return (setup: EditorDriveSetupRecord) => claimAndSendEditorAssignmentEmail(ctx, setup);
}

export function sendEditorAssignmentEmailForReadyAccess(
	ctx: ActionCtx,
	args: { bookingId: Id<"bookings"> }
): ResultAsync<null, DriveEditorPermissionsError> {
	return loadEditorDriveSetup(ctx, args.bookingId)
		.andThen(sendEditorAssignmentEmailForSetup(ctx))
		.orElse(ignoreNonSendableEditorAssignmentEmail);
}

function ignoreNonSendableEditorAssignmentEmail(error: DriveEditorPermissionsError) {
	return error.reason === "EDITOR_ASSIGNMENT_EMAIL_NOT_SENDABLE" ? okAsync(null) : errAsync(error);
}

function recordEditorPermissionFailure(ctx: ActionCtx, setup: EditorDriveSetupRecord) {
	return (error: DriveEditorPermissionsError) =>
		saveEditorPermissionsStatus(ctx, setup, "failed").andThen(rethrowEditorEmailError(error));
}

function ensureEditorDrivePermissionsForSetup(ctx: ActionCtx) {
	return (setup: EditorDriveSetupRecord) =>
		ensureEditorDrivePermissions(ctx, setup)
			.orElse(recordEditorPermissionFailure(ctx, setup))
			.map(returnSetup(setup));
}

function sendEditorAssignmentEmailForBooking(ctx: ActionCtx) {
	return (setup: EditorDriveSetupRecord) =>
		sendEditorAssignmentEmailForReadyAccess(ctx, { bookingId: setup.booking._id });
}

export function setupEditorAccess(
	ctx: ActionCtx,
	args: { bookingId: Id<"bookings"> }
): ResultAsync<null, DriveEditorPermissionsError> {
	return loadEditorDriveSetup(ctx, args.bookingId)
		.andThen(ensureEditorDrivePermissionsForSetup(ctx))
		.andThen(sendEditorAssignmentEmailForBooking(ctx));
}

function setupEditorAccessWhenAssigned(ctx: ActionCtx, args: { bookingId: Id<"bookings"> }) {
	return (setup: DriveSetupInfo | null) => {
		if (setup === null) return errAsync({ reason: "BOOKING_NOT_FOUND" as const });

		if (setup.booking.assignedEditorTokenIdentifier === undefined) return okAsync(null);

		return setupEditorAccess(ctx, args);
	};
}

export function setupEditorAccessIfAssigned(
	ctx: ActionCtx,
	args: { bookingId: Id<"bookings"> }
): ResultAsync<null, DriveEditorPermissionsError> {
	return fromConvexTuple(
		ctx.runQuery(internal.sessionsDriveInternal.getDriveSetup, { bookingId: args.bookingId })
	).andThen(setupEditorAccessWhenAssigned(ctx, args));
}

function removeSavedPermission(
	drive: DriveClient,
	fileId: string | null,
	permission: SavedDrivePermission | null
) {
	if (fileId === null || permission === null) return okAsync(null);

	return deleteDrivePermission(drive, { fileId, permissionId: permission.id });
}

function removeDeliverablesPermissionStep(drive: DriveClient, access: EditorDriveAccessToRemove) {
	return () =>
		removeSavedPermission(drive, access.deliverablesFolderId, access.deliverablesPermission);
}

function removeAssetsPermissionStep(drive: DriveClient, access: EditorDriveAccessToRemove) {
	return () => removeSavedPermission(drive, access.assetsFolderId, access.assetsPermission);
}

function revokePreviousEditorDrivePermissions(
	drive: DriveClient,
	access: EditorDriveAccessToRemove
) {
	return removeSavedPermission(drive, access.sessionFolderId, access.sessionPermission)
		.andThen(removeDeliverablesPermissionStep(drive, access))
		.andThen(removeAssetsPermissionStep(drive, access));
}

function clearPreviousEditorDriveAccessRecord(
	ctx: ActionCtx,
	access: EditorDriveAccessToRemove,
	previousEditorTokenIdentifier: string
) {
	return fromConvexTuple(
		ctx.runMutation(internal.sessionsDriveInternal.clearPreviousEditorDriveAccess, {
			driveClientEditorPermissionId: access.driveClientEditorPermissionId,
			driveSessionId: access.driveSessionId,
			editorTokenIdentifier: previousEditorTokenIdentifier
		})
	);
}

function clearPreviousEditorDriveAccessStep(
	ctx: ActionCtx,
	access: EditorDriveAccessToRemove,
	previousEditorTokenIdentifier: string
) {
	return () => clearPreviousEditorDriveAccessRecord(ctx, access, previousEditorTokenIdentifier);
}

function revokePreviousEditorPermissionsForAccess(access: EditorDriveAccessToRemove) {
	return (drive: DriveClient) => revokePreviousEditorDrivePermissions(drive, access);
}

export function removePreviousEditorDriveAccess(
	ctx: ActionCtx,
	args: { access: EditorDriveAccessToRemove | null; previousEditorTokenIdentifier: string }
): ResultAsync<null, DriveEditorPermissionsError> {
	if (args.access === null) return okAsync(null);
	const access = args.access;

	return loadDriveClient()
		.andThen(revokePreviousEditorPermissionsForAccess(access))
		.andThen(clearPreviousEditorDriveAccessStep(ctx, access, args.previousEditorTokenIdentifier));
}

function removeDeliverablesPermissionForFailedEditor(
	drive: DriveClient,
	removal: FailedEditorRemoval
) {
	return () =>
		findAndDeleteEditorPermission(
			drive,
			removal.deliverablesFolderId,
			removal.editorEmail,
			"writer"
		);
}

function removeAssetsPermissionForFailedEditor(drive: DriveClient, removal: FailedEditorRemoval) {
	return () =>
		findAndDeleteEditorPermission(drive, removal.assetsFolderId, removal.editorEmail, "reader");
}

function revokeFailedEditorDrivePermissions(drive: DriveClient, removal: FailedEditorRemoval) {
	return findAndDeleteEditorPermission(
		drive,
		removal.sessionFolderId,
		removal.editorEmail,
		"reader"
	)
		.andThen(removeDeliverablesPermissionForFailedEditor(drive, removal))
		.andThen(removeAssetsPermissionForFailedEditor(drive, removal));
}

function clearFailedEditorDriveAccessRecord(ctx: ActionCtx, removal: FailedEditorRemoval) {
	return fromConvexTuple(
		ctx.runMutation(internal.sessionsDriveInternal.clearPreviousEditorDriveAccess, {
			driveClientEditorPermissionId: removal.driveClientEditorPermissionId,
			driveSessionId: removal.driveSessionId,
			editorTokenIdentifier: removal.editorTokenIdentifier
		})
	);
}

function clearFailedEditorDriveAccessStep(ctx: ActionCtx, removal: FailedEditorRemoval) {
	return () => clearFailedEditorDriveAccessRecord(ctx, removal);
}

function revokeFailedEditorPermissionsForRemoval(removal: FailedEditorRemoval) {
	return (drive: DriveClient) => revokeFailedEditorDrivePermissions(drive, removal);
}

export function removeFailedEditorDriveAccess(
	ctx: ActionCtx,
	removal: FailedEditorRemoval
): ResultAsync<null, DriveEditorPermissionsError> {
	return loadDriveClient()
		.andThen(revokeFailedEditorPermissionsForRemoval(removal))
		.andThen(clearFailedEditorDriveAccessStep(ctx, removal));
}

function deleteFoundEditorPermission(
	drive: DriveClient,
	fileId: string,
	permission: SavedDrivePermission | null
) {
	return permission === null
		? okAsync(null)
		: deleteDrivePermission(drive, { fileId, permissionId: permission.id });
}

function findAndDeleteEditorPermission(
	drive: DriveClient,
	fileId: string | null,
	editorEmail: string,
	role: "reader" | "writer"
) {
	if (fileId === null) return okAsync(null);

	return findDrivePermission(drive, {
		email: normalizeDriveEmail(editorEmail),
		fileId,
		role
	}).andThen(deleteFoundEditorPermissionForFile(drive, fileId));
}

function deleteFoundEditorPermissionForFile(drive: DriveClient, fileId: string) {
	return (permission: SavedDrivePermission | null) =>
		deleteFoundEditorPermission(drive, fileId, permission);
}
