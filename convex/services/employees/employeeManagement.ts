import { ResultAsync } from "neverthrow";
import type { Doc } from "#convex/_generated/dataModel";
import type { MutationCtx, QueryCtx } from "#convex/_generated/server";
import {
	getEditorProfileByToken,
	getEditorWorkStatus,
	listEditorProfiles,
	patchEditorAccess,
	patchEditorNotes
} from "#convex/lib/editor/editorAccess";

function loadEditorWithWorkStatus(ctx: QueryCtx, editor: Doc<"editorProfiles">) {
	return getEditorWorkStatus(ctx, editor.tokenIdentifier).map((workStatus) => ({
		tokenIdentifier: editor.tokenIdentifier,
		displayName: editor.displayName,
		email: editor.email,
		isActive: editor.isActive,
		lastAssignedAt: editor.lastAssignedAt,
		notes: editor.notes,
		totalEdits: editor.totalEdits,
		workStatus
	}));
}

export function loadEmployeeRoster(ctx: QueryCtx) {
	return listEditorProfiles(ctx).andThen((editors) =>
		ResultAsync.combine(editors.map((editor) => loadEditorWithWorkStatus(ctx, editor)))
	);
}

export function saveEmployeeAccess(ctx: MutationCtx, tokenIdentifier: string, isActive: boolean) {
	return getEditorProfileByToken(ctx, tokenIdentifier).andThen((editor) =>
		patchEditorAccess(ctx, editor._id, isActive)
	);
}

export function saveEmployeeNotes(ctx: MutationCtx, tokenIdentifier: string, notes: string) {
	return getEditorProfileByToken(ctx, tokenIdentifier).andThen((editor) =>
		patchEditorNotes(ctx, editor._id, notes)
	);
}
