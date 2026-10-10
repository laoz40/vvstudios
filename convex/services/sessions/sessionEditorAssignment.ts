import { err, ok, okAsync, type Result, type ResultAsync } from "neverthrow";
import type { Doc } from "#convex/_generated/dataModel";
import type { MutationCtx } from "#convex/_generated/server";
import { loadDriveSessionRowByBookingId } from "#convex/lib/drive/driveBookingDriveClient";
import {
	editorProfileDisplayName,
	lookupEditorProfileByToken,
	requireActiveEditor,
	patchBookingEditorAssignment,
	patchEditorProfileLastAssignedAt,
	scheduleEditorDriveAccessSetup,
	scheduleEditorDriveAccessUpdate
} from "#convex/lib/editor/editorAssignments";
import {
	searchBlobPatchForBookingAsync,
	type BookingSearchBlobPatch
} from "#convex/lib/adminSearch/adminSearchBlob";

function isEditorAssignableSession(session: Doc<"bookings">): boolean {
	return session.status === "confirmed" || session.status === "email_failed";
}

function requireEditorAssignableSession(
	session: Doc<"bookings">
): Result<Doc<"bookings">, { reason: "SESSION_NOT_ASSIGNABLE" }> {
	if (!isEditorAssignableSession(session)) {
		return err({ reason: "SESSION_NOT_ASSIGNABLE" as const });
	}

	return ok(session);
}

function patchEditorAssignmentAfterSearchStep(
	ctx: MutationCtx,
	session: Doc<"bookings">,
	editor: Doc<"editorProfiles"> | undefined,
	adminNotes: string,

	searchBlobPatch: BookingSearchBlobPatch
) {
	return patchBookingEditorAssignment(ctx, session._id, {
		adminNotes: adminNotes.trim() || undefined,
		assignedEditorTokenIdentifier: editor?.tokenIdentifier,
		searchBlobPatch
	});
}

function patchLastAssignedIfEditorStep(
	ctx: MutationCtx,
	editor: Doc<"editorProfiles"> | undefined
) {
	if (editor === undefined) {
		return okAsync(null);
	}

	return patchEditorProfileLastAssignedAt(ctx, editor._id);
}

function scheduleDriveAccessRemovalIfNeededStep(
	ctx: MutationCtx,
	sessionId: Doc<"bookings">["_id"],
	previousEditorNeedsAccessRemoved: boolean,
	previousEditorTokenIdentifier: string | undefined
) {
	if (!previousEditorNeedsAccessRemoved) {
		return okAsync(null);
	}

	return scheduleEditorDriveAccessUpdate(ctx, sessionId, previousEditorTokenIdentifier!);
}

function scheduleFirstAssignmentDriveSetupStep(
	ctx: MutationCtx,
	sessionId: Doc<"bookings">["_id"],
	isFirstAssignment: boolean
) {
	if (!isFirstAssignment) {
		return okAsync(null);
	}

	return scheduleEditorDriveAccessSetup(ctx, sessionId);
}

function saveSessionEditorAssignment(
	ctx: MutationCtx,
	session: Doc<"bookings">,
	editor: Doc<"editorProfiles"> | undefined,
	adminNotes: string
): ResultAsync<null, never> {
	return loadDriveSessionRowByBookingId(ctx, session._id).andThen((driveSession) =>
		saveSessionEditorAssignmentWithAccess(ctx, session, editor, adminNotes, driveSession)
	);
}

function saveSessionEditorAssignmentWithAccess(
	ctx: MutationCtx,
	session: Doc<"bookings">,
	editor: Doc<"editorProfiles"> | undefined,
	adminNotes: string,
	driveSession: Doc<"driveSessions"> | null
): ResultAsync<null, never> {
	// Retirement clears the booking before asynchronous Drive cleanup finishes.
	// Keep that cleanup ahead of replacement access even when the booking is unassigned.
	const previousEditorTokenIdentifier =
		session.assignedEditorTokenIdentifier ?? driveSession?.editorDrivePermissionsTokenIdentifier;

	const assignedEditorDisplayName =
		editor !== undefined ? editorProfileDisplayName(editor) : undefined;

	const editorChanged = previousEditorTokenIdentifier !== editor?.tokenIdentifier;

	const previousEditorNeedsAccessRemoved =
		previousEditorTokenIdentifier !== undefined && editorChanged;

	const isFirstAssignment =
		!previousEditorNeedsAccessRemoved &&
		session.assignedEditorTokenIdentifier === undefined &&
		editor !== undefined;

	return searchBlobPatchForBookingAsync(ctx, {
		...session,
		assignedEditorTokenIdentifier: editor?.tokenIdentifier,
		assignedEditorDisplayName
	})
		.andThen((searchBlobPatch: BookingSearchBlobPatch) =>
			patchEditorAssignmentAfterSearchStep(ctx, session, editor, adminNotes, searchBlobPatch)
		)
		.andThen(() => patchLastAssignedIfEditorStep(ctx, editor))
		.andThen(() =>
			scheduleDriveAccessRemovalIfNeededStep(
				ctx,
				session._id,
				previousEditorNeedsAccessRemoved,
				previousEditorTokenIdentifier
			)
		)
		.andThen(() => scheduleFirstAssignmentDriveSetupStep(ctx, session._id, isFirstAssignment));
}

function assignEditorToSessionStep(
	ctx: MutationCtx,
	session: Doc<"bookings">,
	adminNotes: string,
	editor: Doc<"editorProfiles">
) {
	return saveSessionEditorAssignment(ctx, session, editor, adminNotes);
}

function lookupEditorProfileByTokenStep(ctx: MutationCtx, editorTokenIdentifier: string) {
	return lookupEditorProfileByToken(ctx, editorTokenIdentifier);
}

export function updateSessionEditorAssignment(
	ctx: MutationCtx,
	session: Doc<"bookings">,
	editorTokenIdentifier: string | null,
	adminNotes: string
) {
	if (editorTokenIdentifier === null) {
		return saveSessionEditorAssignment(ctx, session, undefined, adminNotes);
	}

	return requireEditorAssignableSession(session)
		.asyncAndThen(() => lookupEditorProfileByTokenStep(ctx, editorTokenIdentifier))
		.andThen(requireActiveEditor)
		.andThen((editor: Doc<"editorProfiles">) =>
			assignEditorToSessionStep(ctx, session, adminNotes, editor)
		);
}
