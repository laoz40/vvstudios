import { v } from "convex/values";
import { tupleErr, tupleOk } from "#/lib/result";
import { internalQuery, mutation, query } from "#convex/_generated/server";
import {
	getEditorByToken as findEditorByToken,
	loadUserAccessForIdentity,
	requireAdminIdentity,
	requireUser,
	saveAdminEditorEnrollment,
	saveSignedInEditorProfile
} from "#convex/services/auth";

export const getEditorByToken = internalQuery({
	args: { token: v.string() },
	handler: (ctx, args) => findEditorByToken(ctx, args.token).match(tupleOk, tupleErr)
});

export const getCurrentUserAccess = query({
	args: {},
	handler: (ctx) =>
		requireUser(ctx)
			.andThen((identity) => loadUserAccessForIdentity(ctx, identity))
			.match(tupleOk, tupleErr)
});

export const createEditorUser = mutation({
	args: {},
	handler: (ctx) =>
		requireUser(ctx)
			.andThen((identity) => saveSignedInEditorProfile(ctx, identity))
			.match(tupleOk, tupleErr)
});

export const enrollAdminAsEditor = mutation({
	args: {},
	handler: (ctx) =>
		requireUser(ctx)
			.andThen(requireAdminIdentity)
			.andThen((identity) => saveAdminEditorEnrollment(ctx, identity))
			.match(tupleOk, tupleErr)
});
