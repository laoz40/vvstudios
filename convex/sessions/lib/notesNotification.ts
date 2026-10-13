import { okAsync, type ResultAsync } from "neverthrow";
import { internal } from "#convex/_generated/api";
import type { Doc } from "#convex/_generated/dataModel";
import type { MutationCtx } from "#convex/_generated/server";
import { getEditorByToken } from "#convex/shared/lib/auth";
import { okOrThrow } from "#convex/shared/lib/result";

function hasUpdatedNotes(previousNotes: string | undefined, nextNotes: string) {
	const notes = nextNotes.trim();

	return notes !== "" && notes !== (previousNotes ?? "");
}

export function loadEditorForAdminNotesNotification(
	ctx: MutationCtx,
	session: Doc<"bookings">,
	adminNotes: string
) {
	const editorTokenIdentifier = session.assignedEditorTokenIdentifier;

	if (!hasUpdatedNotes(session.adminNotes, adminNotes) || !editorTokenIdentifier) {
		return okAsync(null);
	}

	return getEditorByToken(ctx, editorTokenIdentifier);
}

export function scheduleAdminNotesEmail(
	ctx: MutationCtx,
	session: Doc<"bookings">,
	adminNotes: string,
	editor: Doc<"editorProfiles"> | null | undefined
): ResultAsync<null, never> {
	if (!editor?.isActive || !editor.email || !hasUpdatedNotes(session.adminNotes, adminNotes)) {
		return okAsync(null);
	}

	return okOrThrow(
		ctx.scheduler
			.runAfter(0, internal.sessions.notesEmail.sendSessionNotesEmail, {
				notification: {
					kind: "admin",
					clientName: session.name,
					sessionDate: session.date,
					notes: adminNotes.trim(),
					editorEmail: editor.email,
					idempotencyKey: `admin-notes:${session._id}:${Date.now()}:${Math.random()}`
				}
			})
			.then(() => null)
	);
}

export function scheduleEditorNotesEmail(
	ctx: MutationCtx,
	session: Doc<"bookings">,
	editorNotes: string
): ResultAsync<null, never> {
	if (!hasUpdatedNotes(session.editorNotes, editorNotes)) {
		return okAsync(null);
	}

	return okOrThrow(
		ctx.scheduler
			.runAfter(0, internal.sessions.notesEmail.sendSessionNotesEmail, {
				notification: {
					kind: "editor",
					clientName: session.name,
					sessionDate: session.date,
					notes: editorNotes.trim(),
					idempotencyKey: `editor-notes:${session._id}:${Date.now()}:${Math.random()}`
				}
			})
			.then(() => null)
	);
}
