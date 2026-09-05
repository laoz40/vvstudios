import { err, ok, type Result } from "neverthrow";
import { internal } from "#convex/_generated/api";
import type { Doc } from "#convex/_generated/dataModel";
import type { MutationCtx, QueryCtx } from "#convex/_generated/server";
import { getEditorWorkStatus } from "#convex/lib/editorAccess";
import { isEditorVisibleSession } from "#convex/lib/editorSessions";
import { okOrThrow } from "#convex/lib/result";

const ACTIVE_EDITOR_LIMIT = 200;

export function listActiveEditorProfiles(ctx: QueryCtx) {
	return okOrThrow(
		ctx.db
			.query("editorProfiles")
			.withIndex("by_isActive", (query) => query.eq("isActive", true))
			.take(ACTIVE_EDITOR_LIMIT)
	);
}

// TODO(scale): This indexed lookup runs once per active editor; persist workload counters if that becomes inefficient at scale.
export async function buildActiveEditorProjection(ctx: QueryCtx, editor: Doc<"editorProfiles">) {
	return {
		tokenIdentifier: editor.tokenIdentifier,
		displayName: editor.displayName,
		email: editor.email,
		totalEdits: editor.totalEdits,
		workStatus: await getEditorWorkStatus(ctx, editor.tokenIdentifier)
	};
}

export function getActiveEditor(ctx: MutationCtx, editorTokenIdentifier: string) {
	return okOrThrow(
		ctx.db
			.query("editorProfiles")
			.withIndex("by_tokenIdentifier", (query) =>
				query.eq("tokenIdentifier", editorTokenIdentifier)
			)
			.unique()
	).andThen((editor) => {
		if (editor === null || !editor.isActive) {
			return err({ reason: "EDITOR_NOT_ACTIVE" as const });
		}

		return ok(editor);
	});
}

function requireEditorAssignableSession(
	session: Doc<"bookings">
): Result<Doc<"bookings">, { reason: "SESSION_NOT_ASSIGNABLE" }> {
	if (!isEditorVisibleSession(session)) {
		return err({ reason: "SESSION_NOT_ASSIGNABLE" as const });
	}

	return ok(session);
}

function saveSessionEditorAssignment(
	ctx: MutationCtx,
	session: Doc<"bookings">,
	editor: Doc<"editorProfiles"> | undefined,
	adminNotes: string
) {
	return okOrThrow(
		(async () => {
			const previousEditorTokenIdentifier = session.assignedEditorTokenIdentifier;
			await ctx.db.patch(session._id, {
				adminNotes: adminNotes.trim() || undefined,
				assignedEditorTokenIdentifier: editor?.tokenIdentifier
			});

			// Assignment and the editor's latest-assignment timestamp are saved in one transaction.
			if (editor !== undefined) {
				await ctx.db.patch(editor._id, { lastAssignedAt: Date.now() });
			}

			const editorChanged = previousEditorTokenIdentifier !== editor?.tokenIdentifier;
			const previousEditorNeedsAccessRemoved =
				previousEditorTokenIdentifier !== undefined && editorChanged;

			// Reassignment and unassignment must remove the previous editor before adding new access.
			if (previousEditorNeedsAccessRemoved) {
				await ctx.scheduler.runAfter(0, internal.drive.updateEditorDriveAccess, {
					bookingId: session._id,
					previousEditorTokenIdentifier
				});
			}

			const isFirstAssignment = previousEditorTokenIdentifier === undefined && editor !== undefined;
			// A first assignment has no old Drive access to remove.
			if (isFirstAssignment) {
				await ctx.scheduler.runAfter(0, internal.drive.setupEditorAccess, {
					bookingId: session._id
				});
			}

			return null;
		})()
	);
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
		.asyncAndThen(() => getActiveEditor(ctx, editorTokenIdentifier))
		.andThen((editor) => saveSessionEditorAssignment(ctx, session, editor, adminNotes));
}
