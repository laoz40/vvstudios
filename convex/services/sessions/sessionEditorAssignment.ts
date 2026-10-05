import { err, ok, okAsync, type Result, type ResultAsync } from "neverthrow";
import type { Doc } from "#convex/_generated/dataModel";
import type { MutationCtx } from "#convex/_generated/server";
import {
	editorProfileDisplayName,
	lookupEditorProfileByToken,
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

function requireActiveEditor(
	editor: Doc<"editorProfiles"> | null
): Result<Doc<"editorProfiles">, { reason: "EDITOR_NOT_ACTIVE" }> {
	if (editor === null || !editor.isActive) {
		return err({ reason: "EDITOR_NOT_ACTIVE" as const });
	}

	return ok(editor);
}

function patchEditorAssignmentAfterSearchStep(
	ctx: MutationCtx,
	session: Doc<"bookings">,
	editor: Doc<"editorProfiles"> | undefined,
	adminNotes: string
) {
	return (searchBlobPatch: BookingSearchBlobPatch) =>
		patchBookingEditorAssignment(ctx, session._id, {
			adminNotes: adminNotes.trim() || undefined,
			assignedEditorTokenIdentifier: editor?.tokenIdentifier,
			searchBlobPatch
		});
}

function patchLastAssignedIfEditorStep(
	ctx: MutationCtx,
	editor: Doc<"editorProfiles"> | undefined
) {
	return () => {
		if (editor === undefined) {
			return okAsync(null);
		}

		return patchEditorProfileLastAssignedAt(ctx, editor._id);
	};
}

function scheduleDriveAccessRemovalIfNeededStep(
	ctx: MutationCtx,
	sessionId: Doc<"bookings">["_id"],
	previousEditorNeedsAccessRemoved: boolean,
	previousEditorTokenIdentifier: string | undefined
) {
	return () => {
		if (!previousEditorNeedsAccessRemoved) {
			return okAsync(null);
		}

		return scheduleEditorDriveAccessUpdate(ctx, sessionId, previousEditorTokenIdentifier!);
	};
}

function scheduleFirstAssignmentDriveSetupStep(
	ctx: MutationCtx,
	sessionId: Doc<"bookings">["_id"],
	isFirstAssignment: boolean
) {
	return () => {
		if (!isFirstAssignment) {
			return okAsync(null);
		}

		return scheduleEditorDriveAccessSetup(ctx, sessionId);
	};
}

function saveSessionEditorAssignment(
	ctx: MutationCtx,
	session: Doc<"bookings">,
	editor: Doc<"editorProfiles"> | undefined,
	adminNotes: string
): ResultAsync<null, never> {
	const previousEditorTokenIdentifier = session.assignedEditorTokenIdentifier;

	const assignedEditorDisplayName =
		editor !== undefined ? editorProfileDisplayName(editor) : undefined;

	const editorChanged = previousEditorTokenIdentifier !== editor?.tokenIdentifier;

	const previousEditorNeedsAccessRemoved =
		previousEditorTokenIdentifier !== undefined && editorChanged;

	const isFirstAssignment = previousEditorTokenIdentifier === undefined && editor !== undefined;

	return searchBlobPatchForBookingAsync(ctx, {
		...session,
		assignedEditorTokenIdentifier: editor?.tokenIdentifier,
		assignedEditorDisplayName
	})
		.andThen(patchEditorAssignmentAfterSearchStep(ctx, session, editor, adminNotes))
		.andThen(patchLastAssignedIfEditorStep(ctx, editor))
		.andThen(
			scheduleDriveAccessRemovalIfNeededStep(
				ctx,
				session._id,
				previousEditorNeedsAccessRemoved,
				previousEditorTokenIdentifier
			)
		)
		.andThen(scheduleFirstAssignmentDriveSetupStep(ctx, session._id, isFirstAssignment));
}

function assignEditorToSessionStep(ctx: MutationCtx, session: Doc<"bookings">, adminNotes: string) {
	return (editor: Doc<"editorProfiles">) =>
		saveSessionEditorAssignment(ctx, session, editor, adminNotes);
}

function lookupEditorProfileByTokenStep(ctx: MutationCtx, editorTokenIdentifier: string) {
	return () => lookupEditorProfileByToken(ctx, editorTokenIdentifier);
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
		.asyncAndThen(lookupEditorProfileByTokenStep(ctx, editorTokenIdentifier))
		.andThen(requireActiveEditor)
		.andThen(assignEditorToSessionStep(ctx, session, adminNotes));
}
