import { v } from "convex/values";
import { ok, safeTry } from "neverthrow";
import { tupleErr, tupleOk } from "#/lib/result";
import { internalQuery, mutation, query } from "#convex/_generated/server";
import {
	getEditorByToken as findEditorByToken,
	loadUserAccessForIdentity,
	requireAdminIdentity,
	requireUser,
	saveAdminEditorEnrollment,
	saveSignedInEditorProfile
} from "#convex/shared/services/auth";

export const getEditorByToken = internalQuery({
	args: { token: v.string() },
	handler: (ctx, args) => findEditorByToken(ctx, args.token).match(tupleOk, tupleErr)
});

export const getCurrentUserAccess = query({
	args: {},
	handler: (ctx) =>
		safeTry(async function* () {
			const identity = yield* requireUser(ctx);
			const access = yield* loadUserAccessForIdentity(ctx, identity);

			return ok(access);
		}).match(tupleOk, tupleErr)
});

export const createEditorUser = mutation({
	args: {},
	handler: (ctx) =>
		safeTry(async function* () {
			const identity = yield* requireUser(ctx);
			const profile = yield* saveSignedInEditorProfile(ctx, identity);

			return ok(profile);
		}).match(tupleOk, tupleErr)
});

export const enrollAdminAsEditor = mutation({
	args: {},
	handler: (ctx) =>
		safeTry(async function* () {
			const user = yield* requireUser(ctx);
			const identity = yield* requireAdminIdentity(user);
			const enrollment = yield* saveAdminEditorEnrollment(ctx, identity);

			return ok(enrollment);
		}).match(tupleOk, tupleErr)
});
