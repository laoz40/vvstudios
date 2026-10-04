import { v } from "convex/values";
import { tupleErr, tupleOk } from "#/lib/result";
import { mutation, query } from "#convex/_generated/server";
import { requirePermission } from "#convex/lib/auth";
import {
	buildEditorManagementProjection,
	listEditorProfiles,
	updateEditorAccess,
	updateEditorNotes
} from "#convex/lib/editor/editorAccess";
import { okOrThrow } from "#convex/lib/result";

export const listEmployees = query({
	args: {},
	handler: (ctx) =>
		requirePermission(ctx, "update:editor-access")
			.andThen(() => listEditorProfiles(ctx))
			.andThen((editors) =>
				// Deriving workload from sessions creates one bounded query per editor and is
				// acceptable for the studio's small editor count.
				okOrThrow(
					Promise.all(editors.map((editor) => buildEditorManagementProjection(ctx, editor)))
				)
			)
			.match(tupleOk, tupleErr)
});

export const updateEmployeeNotes = mutation({
	args: { tokenIdentifier: v.string(), notes: v.string() },
	handler: (ctx, args) =>
		requirePermission(ctx, "update:editor-access")
			.andThen(() => updateEditorNotes(ctx, args.tokenIdentifier, args.notes))
			.match(tupleOk, tupleErr)
});

export const updateEmployeeAccess = mutation({
	args: { tokenIdentifier: v.string(), isActive: v.boolean() },
	handler: (ctx, args) =>
		requirePermission(ctx, "update:editor-access")
			.andThen(() => updateEditorAccess(ctx, args.tokenIdentifier, args.isActive))
			.match(tupleOk, tupleErr)
});
