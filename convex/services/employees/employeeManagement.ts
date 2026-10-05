import type { MutationCtx, QueryCtx } from "#convex/_generated/server";
import {
	listEmployeesForManagement,
	updateEditorAccess,
	updateEditorNotes
} from "#convex/lib/editor/editorAccess";

export function loadEmployeeRoster(ctx: QueryCtx) {
	return listEmployeesForManagement(ctx);
}

export function saveEmployeeAccess(ctx: MutationCtx, tokenIdentifier: string, isActive: boolean) {
	return updateEditorAccess(ctx, tokenIdentifier, isActive);
}

export function saveEmployeeNotes(ctx: MutationCtx, tokenIdentifier: string, notes: string) {
	return updateEditorNotes(ctx, tokenIdentifier, notes);
}
