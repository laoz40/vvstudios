import type { MutationCtx, QueryCtx } from "#convex/_generated/server";
import {
	listEmployeesForManagement,
	updateEditorAccess,
	updateEditorNotes
} from "#convex/lib/editor/editorAccess";

export function loadEmployeeRoster(ctx: QueryCtx) {
	return listEmployeesForManagement(ctx);
}

export function saveEmployeeNotes(
	ctx: MutationCtx,
	args: { tokenIdentifier: string; notes: string }
) {
	return updateEditorNotes(ctx, args.tokenIdentifier, args.notes);
}

export function saveEmployeeAccess(
	ctx: MutationCtx,
	args: { tokenIdentifier: string; isActive: boolean }
) {
	return updateEditorAccess(ctx, args.tokenIdentifier, args.isActive);
}
