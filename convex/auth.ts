import { v } from "convex/values";
import { tupleErr, tupleOk } from "#/lib/result";
import { internalQuery, mutation, query } from "#convex/_generated/server";
import { getEditorByToken as findEditorByToken } from "#convex/lib/auth";
import { createEditorUserService, getCurrentUserAccessService } from "#convex/services/auth";

export const getEditorByToken = internalQuery({
	args: { token: v.string() },
	handler: (ctx, args) => findEditorByToken(ctx, args.token).match(tupleOk, tupleErr)
});

export const getCurrentUserAccess = query({
	args: {},
	handler: (ctx) => getCurrentUserAccessService(ctx).match(tupleOk, tupleErr)
});

export const createEditorUser = mutation({
	args: {},
	handler: (ctx) => createEditorUserService(ctx).match(tupleOk, tupleErr)
});
