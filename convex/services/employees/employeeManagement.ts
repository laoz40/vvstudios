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

function mapEditorWithWorkStatus(editor: Doc<"editorProfiles">, workStatus: EmployeeWorkStatus) {
	return {
		tokenIdentifier: editor.tokenIdentifier,
		displayName: editor.displayName,
		email: editor.email,
		isActive: editor.isActive,
		lastAssignedAt: editor.lastAssignedAt,
		notes: editor.notes,
		totalEdits: editor.totalEdits,
		workStatus
	};
}

function loadEditorWithWorkStatus(ctx: QueryCtx, editor: Doc<"editorProfiles">) {
	return getEditorWorkStatus(ctx, editor.tokenIdentifier).map((workStatus: EmployeeWorkStatus) =>
		mapEditorWithWorkStatus(editor, workStatus)
	);
}

function loadEachEditorWorkStatus(ctx: QueryCtx, editor: Doc<"editorProfiles">) {
	return loadEditorWithWorkStatus(ctx, editor);
}

function combineEditorWorkStatuses(ctx: QueryCtx, editors: Doc<"editorProfiles">[]) {
	return ResultAsync.combine(
		editors.map((editor: Doc<"editorProfiles">) => loadEachEditorWorkStatus(ctx, editor))
	);
}

export function loadEmployeeRoster(ctx: QueryCtx) {
	return listEditorProfiles(ctx).andThen((editors: Doc<"editorProfiles">[]) =>
		combineEditorWorkStatuses(ctx, editors)
	);
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

function patchEmployeeAccess(ctx: MutationCtx, isActive: boolean, editor: Doc<"editorProfiles">) {
	return patchEditorAccess(ctx, editor._id, isActive);
}

function patchEmployeeNotes(ctx: MutationCtx, notes: string, editor: Doc<"editorProfiles">) {
	return patchEditorNotes(ctx, editor._id, notes);
}

export function saveEmployeeAccess(ctx: MutationCtx, tokenIdentifier: string, isActive: boolean) {
	return requireEditorProfileByToken(ctx, tokenIdentifier).andThen(
		(editor: Doc<"editorProfiles">) => patchEmployeeAccess(ctx, isActive, editor)
	);
}

export function saveEmployeeNotes(ctx: MutationCtx, tokenIdentifier: string, notes: string) {
	return requireEditorProfileByToken(ctx, tokenIdentifier).andThen(
		(editor: Doc<"editorProfiles">) => patchEmployeeNotes(ctx, notes, editor)
	);
}
