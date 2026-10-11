import { err, errAsync, ok, okAsync, type ResultAsync, type Result } from "neverthrow";
import type { Doc } from "#convex/_generated/dataModel";
import type { MutationCtx } from "#convex/_generated/server";

import {
	editorProfileDisplayName,
	lookupEditorProfileByToken,
	requireActiveEditor,
	patchBookingEditorAssignment,
	patchEditorProfileLastAssignedAt,
	scheduleEditorDriveAccessSetup,
	scheduleEditorDriveAccessUpdate
} from "#convex/editor/lib/editorAssignments";
import { type BookingSearchBlobPatch } from "#convex/shared/lib/adminSearch/adminSearchBlob";

export function isEditorAssignableSession(session: Doc<"bookings">): boolean {
	return session.status === "confirmed" || session.status === "email_failed";
}

export function requireEditorAssignableSession(
	session: Doc<"bookings">
): Result<Doc<"bookings">, { reason: "SESSION_NOT_ASSIGNABLE" }> {
	if (!isEditorAssignableSession(session)) {
		return err({ reason: "SESSION_NOT_ASSIGNABLE" as const });
	}

	return ok(session);
}

export function patchEditorAssignmentAfterSearch(
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

export function patchLastAssignedIfEditor(
	ctx: MutationCtx,
	editor: Doc<"editorProfiles"> | undefined
) {
	if (editor === undefined) {
		return okAsync(null);
	}

	return patchEditorProfileLastAssignedAt(ctx, editor._id);
}

export function scheduleDriveAccessRemovalIfNeeded(
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

export function scheduleFirstAssignmentDriveSetup(
	ctx: MutationCtx,
	sessionId: Doc<"bookings">["_id"],
	isFirstAssignment: boolean
) {
	if (!isFirstAssignment) {
		return okAsync(null);
	}

	return scheduleEditorDriveAccessSetup(ctx, sessionId);
}

export function editorAssignmentAccessState(
	session: Doc<"bookings">,
	editor: Doc<"editorProfiles"> | undefined,
	driveSession: Doc<"driveSessions"> | null
) {
	// Retirement clears the booking before asynchronous Drive cleanup finishes.
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

	return {
		previousEditorTokenIdentifier,
		assignedEditorDisplayName,
		previousEditorNeedsAccessRemoved,
		isFirstAssignment
	};
}

export function editorAssignmentSearchInput(
	session: Doc<"bookings">,
	editor: Doc<"editorProfiles"> | undefined,
	assignedEditorDisplayName: string | undefined
) {
	return {
		...session,
		assignedEditorTokenIdentifier: editor?.tokenIdentifier,
		assignedEditorDisplayName
	};
}

export function loadEditorForSessionAssignment(
	ctx: MutationCtx,
	session: Doc<"bookings">,
	editorTokenIdentifier: string | null
): ResultAsync<Doc<"editorProfiles"> | null | undefined, { reason: "SESSION_NOT_ASSIGNABLE" }> {
	if (editorTokenIdentifier === null) return okAsync(undefined);
	const assignable = requireEditorAssignableSession(session);

	if (assignable.isErr()) return errAsync(assignable.error);

	return lookupEditorProfileByToken(ctx, editorTokenIdentifier);
}

export function requireSelectedAssignmentEditor(editor: Doc<"editorProfiles"> | null | undefined) {
	if (editor === undefined) return ok(undefined);

	return requireActiveEditor(editor);
}
