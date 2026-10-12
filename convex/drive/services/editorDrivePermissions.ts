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

import { err, ok, ResultAsync, safeTry } from "neverthrow";

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

	return safeTry(async function* () {
		const response = yield* findDrivePermissionRequest(drive, input);
		const existing = yield* parseDrivePermissionListForRemoval(response, input);

		const permissionResponse = yield* createDrivePermissionIfMissingRequest(
			drive,
			{
				email: normalizeDriveEmail(editorEmail),
				fileId: requirement.fileId,
				role: requirement.role,
				sendNotificationEmail: false
			},
			existing
		);

		return ok(yield* parseDrivePermissionResponse(permissionResponse));
	});
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
	return safeTry(async function* () {
		const sessionRequirement = yield* requireEditorFolder(setup, "Session");

		const sessionPermission = yield* requireEditorPermission(
			drive,
			setup.editor.email,
			sessionRequirement
		);

		yield* saveEditorPermission(ctx, setup, "Session", sessionPermission);

		const assetsRequirement = yield* requireEditorFolder(setup, "Assets");

		const assetsPermission = yield* requireEditorPermission(
			drive,
			setup.editor.email,
			assetsRequirement
		);

		yield* saveEditorPermission(ctx, setup, "Assets", assetsPermission);

		const deliverablesRequirement = yield* requireEditorFolder(setup, "Deliverables");

		const deliverablesPermission = yield* requireEditorPermission(
			drive,
			setup.editor.email,
			deliverablesRequirement
		);

		return ok(yield* saveEditorPermission(ctx, setup, "Deliverables", deliverablesPermission));
	});
}

function ensureEditorDrivePermissions(
	ctx: ActionCtx,
	setup: EditorDriveSetupRecord
): ResultAsync<null, DriveEditorPermissionsError> {
	return safeTry(async function* () {
		yield* requireEditorFolders(setup);
		const drive = yield* loadDriveClient();
		yield* applyEditorDrivePermissionsForDrive(ctx, setup, drive);
		yield* writeEditorPermissionsReady(ctx, setup);

		return ok(null);
	});
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
	const sendAndSave = safeTry(async function* () {
		yield* sendEditorAssignmentEmail({
			editorEmail: claim.editorEmail,
			editorName: claim.editorName,
			sessionName: claim.sessionName,
			sessionStartAt: claim.sessionStartAt
		});

		return ok(yield* saveSentEditorAssignmentEmailAfterSend(ctx, claim));
	});

	return sendAndSave.orElse((error) => recordFailedEditorAssignmentEmail(ctx, claim, error));
}

function recordFailedEditorAssignmentEmail(
	ctx: ActionCtx,
	claim: EditorAssignmentEmailClaim,
	emailError: DriveEditorPermissionsError
) {
	return safeTry(async function* () {
		yield* saveFailedEditorAssignmentEmailResult(ctx, claim);

		return err(emailError);
	});
}

export function sendEditorAssignmentEmailForReadyAccess(
	ctx: ActionCtx,
	args: { bookingId: Id<"bookings"> }
): ResultAsync<null, DriveEditorPermissionsError> {
	return safeTry(async function* () {
		const setup = yield* loadEditorDriveSetup(ctx, args.bookingId);
		const claim = yield* claimEditorEmail(ctx, setup);

		return ok(yield* sendClaimedEditorAssignmentEmail(ctx, claim));
	}).orElse(ignoreNonSendableEditorAssignmentEmail);
}

function recordEditorPermissionFailure(
	ctx: ActionCtx,
	setup: EditorDriveSetupRecord,
	error: DriveEditorPermissionsError
) {
	return safeTry(async function* () {
		yield* saveEditorPermissionsStatus(ctx, setup, "failed");

		return err(error);
	});
}

function ensureEditorDrivePermissionsForSetup(ctx: ActionCtx, setup: EditorDriveSetupRecord) {
	return ensureEditorDrivePermissions(ctx, setup)
		.orElse((error) => recordEditorPermissionFailure(ctx, setup, error))
		.map(() => setup);
}

export function setupEditorAccess(
	ctx: ActionCtx,
	args: { bookingId: Id<"bookings"> }
): ResultAsync<null, DriveEditorPermissionsError> {
	return safeTry(async function* () {
		const setup = yield* loadEditorDriveSetup(ctx, args.bookingId);
		const readySetup = yield* ensureEditorDrivePermissionsForSetup(ctx, setup);
		const claim = yield* claimEditorEmail(ctx, readySetup);

		return ok(yield* sendClaimedEditorAssignmentEmail(ctx, claim));
	});
}

export function setupEditorAccessIfAssigned(
	ctx: ActionCtx,
	args: { bookingId: Id<"bookings"> }
): ResultAsync<null, DriveEditorPermissionsError> {
	return safeTry(async function* () {
		const setup = yield* queryOptionalEditorSetup(ctx, args);
		const bookingIds = yield* selectBookingsForEditorAccessSetup(setup);
		yield* ResultAsync.combine(
			bookingIds.map((bookingId) => setupEditorAccess(ctx, { bookingId }))
		);

		return ok(null);
	});
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
	return safeTry(async function* () {
		yield* removeSavedPermission(
			drive,
			access?.sessionFolderId ?? null,
			access?.sessionPermission ?? null
		);
		yield* removeSavedPermission(
			drive,
			access?.deliverablesFolderId ?? null,
			access?.deliverablesPermission ?? null
		);

		return ok(
			yield* removeSavedPermission(
				drive,
				access?.assetsFolderId ?? null,
				access?.assetsPermission ?? null
			)
		);
	});
}

export function removePreviousEditorDriveAccess(
	ctx: ActionCtx,
	args: { access: EditorDriveAccessToRemove | null; previousEditorTokenIdentifier: string }
): ResultAsync<null, DriveEditorPermissionsError> {
	return safeTry(async function* () {
		const drive = yield* loadEditorDriveClientForRemoval(args.access);
		yield* revokePreviousEditorDrivePermissions(drive, args.access);

		return ok(
			yield* writePreviousEditorDriveAccessCleared(
				ctx,
				args.access,
				args.previousEditorTokenIdentifier
			)
		);
	});
}

function revokeFailedEditorDrivePermissions(
	drive: DriveClient | null,
	removal: FailedEditorRemoval | null
) {
	return safeTry(async function* () {
		yield* findAndDeleteEditorPermission(
			drive,
			removal?.sessionFolderId ?? null,
			removal?.editorEmail ?? "",
			"reader"
		);
		yield* findAndDeleteEditorPermission(
			drive,
			removal?.deliverablesFolderId ?? null,
			removal?.editorEmail ?? "",
			"writer"
		);

		return ok(
			yield* findAndDeleteEditorPermission(
				drive,
				removal?.assetsFolderId ?? null,
				removal?.editorEmail ?? "",
				"reader"
			)
		);
	});
}

export function removeFailedEditorDriveAccess(
	ctx: ActionCtx,
	removal: FailedEditorRemoval | null
): ResultAsync<null, DriveEditorPermissionsError> {
	return safeTry(async function* () {
		const drive = yield* loadEditorDriveClientForRemoval(removal);
		yield* revokeFailedEditorDrivePermissions(drive, removal);

		return ok(yield* clearFailedEditorDriveAccess(ctx, removal));
	});
}

function findAndDeleteEditorPermission(
	drive: DriveClient | null,
	fileId: string | null,
	editorEmail: string,
	role: "reader" | "writer"
) {
	return safeTry(async function* () {
		const response = yield* findDrivePermissionRequest(drive, {
			email: normalizeDriveEmail(editorEmail),
			fileId,
			role
		});

		const permission = yield* parseDrivePermissionListForRemoval(response, {
			email: normalizeDriveEmail(editorEmail),
			fileId,
			role
		});

		return ok(
			yield* deleteDrivePermissionRequest(
				drive,
				fileId === null || permission === null ? null : { fileId, permissionId: permission.id }
			).orElse(ignoreMissingDrivePermission)
		);
	});
}

// Retirement may happen while Google creates the permission; remove that access before returning the save error.
function cleanupUnsavedEditorPermission(
	ctx: ActionCtx,
	setup: EditorDriveSetupRecord,
	fileId: string | null,
	permission: SavedDrivePermission,
	error: DriveEditorPermissionsError
) {
	return safeTry(async function* () {
		yield* deleteUnsavedEditorPermission(fileId, permission).orElse((removalError) =>
			recordUnsavedEditorPermissionRemovalFailure(ctx, setup, removalError)
		);

		return err(error);
	});
}

function deleteUnsavedEditorPermission(fileId: string | null, permission: SavedDrivePermission) {
	return safeTry(async function* () {
		const drive = yield* loadEditorDriveClientForUnsavedPermission(fileId);

		return ok(
			yield* deleteDrivePermissionRequest(
				drive,
				fileId === null ? null : { fileId, permissionId: permission.id }
			).orElse(ignoreMissingDrivePermission)
		);
	});
}

function recordUnsavedEditorPermissionRemovalFailure(
	ctx: ActionCtx,
	setup: EditorDriveSetupRecord,
	removalError: DriveEditorPermissionsError
) {
	return safeTry(async function* () {
		yield* markPreviousEditorRemovalFailed(ctx, {
			bookingId: setup.booking._id,
			editorTokenIdentifier: setup.editor.tokenIdentifier
		});

		return err(removalError);
	});
}
