import { v } from "convex/values";
import { tupleErr, tupleOk } from "#/lib/result";
import { mutation, query } from "#convex/_generated/server";
import {
	listEditorsService,
	updateEditorAccessService,
	updateEditorNotesService
} from "#convex/services/editors";

export const listEditors = query({
	args: {},
	handler: (ctx) => listEditorsService(ctx).match(tupleOk, tupleErr)
});

export const updateEditorNotes = mutation({
	args: { tokenIdentifier: v.string(), notes: v.string() },
	handler: (ctx, args) => updateEditorNotesService(ctx, args).match(tupleOk, tupleErr)
});

export const updateEditorAccess = mutation({
	args: { tokenIdentifier: v.string(), isActive: v.boolean() },
	handler: (ctx, args) => updateEditorAccessService(ctx, args).match(tupleOk, tupleErr)
});
