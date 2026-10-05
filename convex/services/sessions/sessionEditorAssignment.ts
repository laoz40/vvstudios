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
import { searchBlobPatchForBookingAsync } from "#convex/lib/adminSearch/adminSearchBlob";

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
		.andThen((searchBlobPatch) =>
			patchBookingEditorAssignment(ctx, session._id, {
				adminNotes: adminNotes.trim() || undefined,
				assignedEditorTokenIdentifier: editor?.tokenIdentifier,
				searchBlobPatch
			})
		)
		.andThen(() => {
			if (editor === undefined) {
				return okAsync(null);
			}

			return patchEditorProfileLastAssignedAt(ctx, editor._id);
		})
		.andThen(() => {
			if (!previousEditorNeedsAccessRemoved) {
				return okAsync(null);
			}

			return scheduleEditorDriveAccessUpdate(ctx, session._id, previousEditorTokenIdentifier);
		})
		.andThen(() => {
			if (!isFirstAssignment) {
				return okAsync(null);
			}

			return scheduleEditorDriveAccessSetup(ctx, session._id);
		});
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
		.asyncAndThen(() => lookupEditorProfileByToken(ctx, editorTokenIdentifier))
		.andThen(requireActiveEditor)
		.andThen((editor) => saveSessionEditorAssignment(ctx, session, editor, adminNotes));
}
