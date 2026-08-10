import { err, ok } from "neverthrow";
import type { Doc, Id } from "#convex/_generated/dataModel";
import type { MutationCtx, QueryCtx } from "#convex/_generated/server";
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

export function buildActiveEditorProjection(editor: Doc<"editorProfiles">) {
	return {
		tokenIdentifier: editor.tokenIdentifier,
		displayName: editor.displayName,
		email: editor.email
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

export function saveSessionEditorAssignment(
	ctx: MutationCtx,
	bookingId: Id<"bookings">,
	editorTokenIdentifier: string | undefined
) {
	return okOrThrow(
		ctx.db
			.patch(bookingId, { assignedEditorTokenIdentifier: editorTokenIdentifier })
			.then(() => null)
	);
}
