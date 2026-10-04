import type { MutationCtx, QueryCtx } from "#convex/_generated/server";
import { requirePermission } from "#convex/services/auth";
import {
	listEmployeesForManagement,
	updateEditorAccess,
	updateEditorNotes
} from "#convex/lib/editor/editorAccess";

export function listEmployees(ctx: QueryCtx) {
	return requirePermission(ctx, "update:editor-access").andThen(() =>
		listEmployeesForManagement(ctx)
	);
}

export function updateEmployeeNotesForAdmin(
	ctx: MutationCtx,
	args: { tokenIdentifier: string; notes: string }
) {
	return requirePermission(ctx, "update:editor-access").andThen(() =>
		updateEditorNotes(ctx, args.tokenIdentifier, args.notes)
	);
}

export function updateEmployeeAccessForAdmin(
	ctx: MutationCtx,
	args: { tokenIdentifier: string; isActive: boolean }
) {
	return requirePermission(ctx, "update:editor-access").andThen(() =>
		updateEditorAccess(ctx, args.tokenIdentifier, args.isActive)
	);
}
