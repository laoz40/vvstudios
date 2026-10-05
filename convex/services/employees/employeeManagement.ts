import { err, ok, ResultAsync } from "neverthrow";
import type { Doc } from "#convex/_generated/dataModel";
import type { MutationCtx, QueryCtx } from "#convex/_generated/server";
import {
	getEditorWorkStatus,
	listEditorProfiles,
	lookupEditorProfileByToken,
	patchEditorAccess,
	patchEditorNotes
} from "#convex/lib/editor/editorAccess";

type EmployeeWorkStatus = "assigned" | "editing" | "unassigned";

function mapEditorWithWorkStatus(editor: Doc<"editorProfiles">) {
	return (workStatus: EmployeeWorkStatus) => ({
		tokenIdentifier: editor.tokenIdentifier,
		displayName: editor.displayName,
		email: editor.email,
		isActive: editor.isActive,
		lastAssignedAt: editor.lastAssignedAt,
		notes: editor.notes,
		totalEdits: editor.totalEdits,
		workStatus
	});
}

function loadEditorWithWorkStatus(ctx: QueryCtx, editor: Doc<"editorProfiles">) {
	return getEditorWorkStatus(ctx, editor.tokenIdentifier).map(mapEditorWithWorkStatus(editor));
}

function loadEachEditorWorkStatus(ctx: QueryCtx) {
	return (editor: Doc<"editorProfiles">) => loadEditorWithWorkStatus(ctx, editor);
}

function combineEditorWorkStatuses(ctx: QueryCtx) {
	return (editors: Doc<"editorProfiles">[]) =>
		ResultAsync.combine(editors.map(loadEachEditorWorkStatus(ctx)));
}

export function loadEmployeeRoster(ctx: QueryCtx) {
	return listEditorProfiles(ctx).andThen(combineEditorWorkStatuses(ctx));
}

function assertEditorProfileFound(editor: Doc<"editorProfiles"> | null) {
	if (editor === null) {
		return err({ reason: "EDITOR_NOT_FOUND" as const });
	}

	return ok(editor);
}

function requireEditorProfileByToken(ctx: MutationCtx, tokenIdentifier: string) {
	return lookupEditorProfileByToken(ctx, tokenIdentifier).andThen(assertEditorProfileFound);
}

function patchEmployeeAccess(ctx: MutationCtx, isActive: boolean) {
	return (editor: Doc<"editorProfiles">) => patchEditorAccess(ctx, editor._id, isActive);
}

function patchEmployeeNotes(ctx: MutationCtx, notes: string) {
	return (editor: Doc<"editorProfiles">) => patchEditorNotes(ctx, editor._id, notes);
}

export function saveEmployeeAccess(ctx: MutationCtx, tokenIdentifier: string, isActive: boolean) {
	return requireEditorProfileByToken(ctx, tokenIdentifier).andThen(
		patchEmployeeAccess(ctx, isActive)
	);
}

export function saveEmployeeNotes(ctx: MutationCtx, tokenIdentifier: string, notes: string) {
	return requireEditorProfileByToken(ctx, tokenIdentifier).andThen(patchEmployeeNotes(ctx, notes));
}
