import { v } from "convex/values";
import { tupleErr, tupleOk } from "#/lib/result";
import { internalQuery, query } from "#convex/_generated/server";
import { getCurrentUserAccessService, getEditorByTokenService } from "#convex/services/auth";

export const getEditorByToken = internalQuery({
	args: { token: v.string() },
	handler: (ctx, args) => getEditorByTokenService(ctx, args.token).match(tupleOk, tupleErr)
});

export const getCurrentUserAccess = query({
	args: {},
	handler: (ctx) => getCurrentUserAccessService(ctx).match(tupleOk, tupleErr)
});
