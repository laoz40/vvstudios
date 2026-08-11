import type { MutationCtx, QueryCtx } from "#convex/_generated/server";
import { requirePermission } from "#convex/lib/auth";
import {
	buildEditorManagementProjection,
	listEditorProfiles,
	updateEditorAccess,
	updateEditorNotes
} from "#convex/lib/editorAccess";
import { okOrThrow } from "#convex/lib/result";

type UpdateEditorAccessArgs = { tokenIdentifier: string; isActive: boolean };
type UpdateEditorNotesArgs = { tokenIdentifier: string; notes: string };

export function listEditorsService(ctx: QueryCtx) {
	return requirePermission(ctx, "update:editor-access")
		.andThen(() => listEditorProfiles(ctx))
		.andThen((editors) =>
			// Deriving workload from sessions creates one bounded query per editor and is
			// acceptable for the studio's small editor count.
			okOrThrow(Promise.all(editors.map((editor) => buildEditorManagementProjection(ctx, editor))))
		);
}

export function updateEditorAccessService(ctx: MutationCtx, args: UpdateEditorAccessArgs) {
	return requirePermission(ctx, "update:editor-access").andThen(() =>
		updateEditorAccess(ctx, args.tokenIdentifier, args.isActive)
	);
}

export function updateEditorNotesService(ctx: MutationCtx, args: UpdateEditorNotesArgs) {
	return requirePermission(ctx, "update:editor-access").andThen(() =>
		updateEditorNotes(ctx, args.tokenIdentifier, args.notes)
	);
}
