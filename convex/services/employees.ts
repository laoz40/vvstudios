import type { MutationCtx, QueryCtx } from "#convex/_generated/server";
import { requirePermission } from "#convex/lib/auth";
import {
	buildEditorManagementProjection,
	listEditorProfiles,
	updateEditorAccess,
	updateEditorNotes
} from "#convex/lib/editorAccess";
import { okOrThrow } from "#convex/lib/result";

type UpdateEmployeeAccessArgs = { tokenIdentifier: string; isActive: boolean };
type UpdateEmployeeNotesArgs = { tokenIdentifier: string; notes: string };

export function listEmployeesService(ctx: QueryCtx) {
	return requirePermission(ctx, "update:editor-access")
		.andThen(() => listEditorProfiles(ctx))
		.andThen((editors) =>
			// Deriving workload from sessions creates one bounded query per editor and is
			// acceptable for the studio's small editor count.
			okOrThrow(Promise.all(editors.map((editor) => buildEditorManagementProjection(ctx, editor))))
		);
}

export function updateEmployeeAccessService(ctx: MutationCtx, args: UpdateEmployeeAccessArgs) {
	return requirePermission(ctx, "update:editor-access").andThen(() =>
		updateEditorAccess(ctx, args.tokenIdentifier, args.isActive)
	);
}

export function updateEmployeeNotesService(ctx: MutationCtx, args: UpdateEmployeeNotesArgs) {
	return requirePermission(ctx, "update:editor-access").andThen(() =>
		updateEditorNotes(ctx, args.tokenIdentifier, args.notes)
	);
}
