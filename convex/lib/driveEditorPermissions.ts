"use node";

import { errAsync, ok, okAsync, type ResultAsync } from "neverthrow";
import { internal } from "#convex/_generated/api";
import type { Id } from "#convex/_generated/dataModel";
import type { ActionCtx } from "#convex/_generated/server";
import type { EditorDriveAccessToRemove, EditorDriveSetupRecord } from "#convex/lib/driveRecords";
import { sendEditorAssignmentEmail } from "#convex/lib/email";
import {
	createDrivePermission,
	deleteDrivePermission,
	findDrivePermission,
	loadDriveClient,
	normalizeDriveEmail,
	type DriveClient,
	type DriveError,
	type SavedDrivePermission
} from "#convex/lib/googleDrive";
import { fromConvexTuple } from "#convex/lib/result";

export type DriveEditorPermissionsError =
	| DriveError
	| { reason: "BOOKING_NOT_FOUND" | "EDITOR_NOT_ASSIGNED" | "EDITOR_NOT_ACTIVE" }
	| { reason: "DRIVE_FOLDERS_NOT_READY" | "DRIVE_EDITOR_PERMISSIONS_SAVE_FAILED" }
	| { reason: "EDITOR_ASSIGNMENT_EMAIL_NOT_SENDABLE" | "EDITOR_ASSIGNMENT_EMAIL_SEND_FAILED" };

type EditorPermissionRequirement = { fileId: string; role: "reader" | "writer" };

export function loadEditorDriveAccessToRemove(
	ctx: ActionCtx,
	args: { bookingId: Id<"bookings">; editorTokenIdentifier: string }
): ResultAsync<EditorDriveAccessToRemove | null, DriveEditorPermissionsError> {
	return fromConvexTuple(ctx.runQuery(internal.sessions.getEditorDriveAccessToRemove, args)).mapErr(
		() => ({ reason: "DRIVE_EDITOR_PERMISSIONS_SAVE_FAILED" as const })
	);
}

function loadEditorDriveSetup(
	ctx: ActionCtx,
	bookingId: Id<"bookings">
): ResultAsync<EditorDriveSetupRecord, DriveEditorPermissionsError> {
	return fromConvexTuple(ctx.runQuery(internal.sessions.getEditorDriveSetup, { bookingId }));
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
	}).andThen((existingPermission) => {
		if (existingPermission !== null) return ok(existingPermission);
		return createDrivePermission(drive, {
			email: normalizeDriveEmail(editorEmail),
			fileId: requirement.fileId,
			role: requirement.role,
			sendNotificationEmail: false
		});
	});
}

function saveEditorPermission(
	ctx: ActionCtx,
	setup: EditorDriveSetupRecord,
	name: "Assets" | "Deliverables" | "Session",
	permission: SavedDrivePermission
) {
	return fromConvexTuple(
		ctx.runMutation(internal.sessions.saveEditorDrivePermission, {
			bookingId: setup.booking._id,
			editorTokenIdentifier: setup.editor.tokenIdentifier,
			name,
			permission
		})
	).mapErr(() => ({ reason: "DRIVE_EDITOR_PERMISSIONS_SAVE_FAILED" as const }));
}

function saveEditorPermissionsStatus(
	ctx: ActionCtx,
	setup: EditorDriveSetupRecord,
	status: "failed" | "ready"
) {
	return fromConvexTuple(
		ctx.runMutation(internal.sessions.saveEditorDrivePermissionsStatus, {
			bookingId: setup.booking._id,
			editorTokenIdentifier: setup.editor.tokenIdentifier,
			status
		})
	).mapErr(() => ({ reason: "DRIVE_EDITOR_PERMISSIONS_SAVE_FAILED" as const }));
}

function ensureEditorDrivePermissions(
	ctx: ActionCtx,
	setup: EditorDriveSetupRecord
): ResultAsync<null, DriveEditorPermissionsError> {
	const sessionFolder = setup.driveSession.sessionFolder;
	const assetsFolder = setup.driveClient.assetsFolder;
	const deliverablesFolder = setup.driveSession.deliverablesFolder;
	if (
		sessionFolder === undefined ||
		assetsFolder === undefined ||
		deliverablesFolder === undefined
	) {
		return errAsync({ reason: "DRIVE_FOLDERS_NOT_READY" as const });
	}

	return (
		loadDriveClient()
			.andThen((drive) =>
				// Each permission is reused when it already exists, then saved before moving on.
				requireEditorPermission(drive, setup.editor.email, {
					fileId: sessionFolder.id,
					role: "reader"
				})
					.andThen((permission) => saveEditorPermission(ctx, setup, "Session", permission))
					.andThen(() =>
						requireEditorPermission(drive, setup.editor.email, {
							fileId: assetsFolder.id,
							role: "reader"
						})
					)
					.andThen((permission) => saveEditorPermission(ctx, setup, "Assets", permission))
					.andThen(() =>
						requireEditorPermission(drive, setup.editor.email, {
							fileId: deliverablesFolder.id,
							role: "writer"
						})
					)
					.andThen((permission) => saveEditorPermission(ctx, setup, "Deliverables", permission))
			)
			// The overall access status becomes ready only after every permission succeeds.
			.andThen(() => saveEditorPermissionsStatus(ctx, setup, "ready"))
			.map(() => null)
	);
}

export function sendEditorAssignmentEmailForReadyAccess(
	ctx: ActionCtx,
	args: { bookingId: Id<"bookings"> }
): ResultAsync<null, DriveEditorPermissionsError> {
	return loadEditorDriveSetup(ctx, args.bookingId).andThen((setup) =>
		// Claiming first prevents two actions from sending the same email at once.
		fromConvexTuple(
			ctx.runMutation(internal.sessions.claimEditorAssignmentEmail, {
				bookingId: setup.booking._id,
				editorTokenIdentifier: setup.editor.tokenIdentifier,
				now: Date.now()
			})
		)
			.andThen((claim) =>
				// Send the email, then save the result against this exact claim.
				sendEditorAssignmentEmail({
					editorEmail: claim.editorEmail,
					editorName: claim.editorName,
					sessionName: claim.sessionName,
					sessionStartAt: claim.sessionStartAt
				})
					.mapErr(() => ({ reason: "EDITOR_ASSIGNMENT_EMAIL_SEND_FAILED" as const }))
					.andThen(() =>
						fromConvexTuple(
							ctx.runMutation(internal.sessions.saveEditorAssignmentEmailResult, {
								bookingId: claim.bookingId,
								claimedAt: claim.claimedAt,
								editorTokenIdentifier: claim.editorTokenIdentifier,
								status: "sent"
							})
						).mapErr(() => ({ reason: "DRIVE_EDITOR_PERMISSIONS_SAVE_FAILED" as const }))
					)
					.orElse((emailError) =>
						fromConvexTuple(
							ctx.runMutation(internal.sessions.saveEditorAssignmentEmailResult, {
								bookingId: claim.bookingId,
								claimedAt: claim.claimedAt,
								editorTokenIdentifier: claim.editorTokenIdentifier,
								status: "failed"
							})
						)
							.mapErr(() => ({ reason: "DRIVE_EDITOR_PERMISSIONS_SAVE_FAILED" as const }))
							.andThen(() => errAsync(emailError))
					)
			)
			// A missing or duplicate claim means there is nothing to send, not a workflow failure.
			.orElse((error) =>
				error.reason === "EDITOR_ASSIGNMENT_EMAIL_NOT_SENDABLE" ? okAsync(null) : errAsync(error)
			)
	);
}

export function setupEditorAccess(
	ctx: ActionCtx,
	args: { bookingId: Id<"bookings"> }
): ResultAsync<null, DriveEditorPermissionsError> {
	return (
		loadEditorDriveSetup(ctx, args.bookingId)
			.andThen((setup) =>
				// Set up all Drive permissions and record a failed status if any step stops.
				ensureEditorDrivePermissions(ctx, setup)
					.mapErr((error): DriveEditorPermissionsError => error)
					.orElse((error: DriveEditorPermissionsError) =>
						saveEditorPermissionsStatus(ctx, setup, "failed").andThen(() => errAsync(error))
					)
					.map(() => setup)
			)
			// Send the branded email only after Drive access is ready.
			.andThen((setup) =>
				sendEditorAssignmentEmailForReadyAccess(ctx, { bookingId: setup.booking._id })
			)
	);
}

function removeSavedPermission(
	drive: DriveClient,
	fileId: string | null,
	permission: SavedDrivePermission | null
) {
	if (fileId === null || permission === null) return okAsync(null);
	return deleteDrivePermission(drive, { fileId, permissionId: permission.id });
}

export function removePreviousEditorDriveAccess(
	ctx: ActionCtx,
	args: { access: EditorDriveAccessToRemove | null; previousEditorTokenIdentifier: string }
): ResultAsync<null, DriveEditorPermissionsError> {
	if (args.access === null) return okAsync(null);
	const access = args.access;
	return loadDriveClient()
		.andThen((drive) =>
			// Revoke session-specific access before shared client assets access.
			removeSavedPermission(drive, access.sessionFolderId, access.sessionPermission)
				.andThen(() =>
					removeSavedPermission(drive, access.deliverablesFolderId, access.deliverablesPermission)
				)
				.andThen(() => removeSavedPermission(drive, access.assetsFolderId, access.assetsPermission))
		)
		.andThen(() =>
			fromConvexTuple(
				ctx.runMutation(internal.sessions.clearPreviousEditorDriveAccess, {
					driveClientEditorPermissionId: access.driveClientEditorPermissionId,
					driveSessionId: access.driveSessionId,
					editorTokenIdentifier: args.previousEditorTokenIdentifier
				})
			).mapErr(() => ({ reason: "DRIVE_EDITOR_PERMISSIONS_SAVE_FAILED" as const }))
		);
}
