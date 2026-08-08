import type { UserIdentity } from "convex/server";
import type { QueryCtx } from "#convex/_generated/server";
import { requireAuthenticatedIdentity, resolveUserAccess } from "#convex/lib/auth";
import { okOrThrow } from "#convex/lib/result";

export function getEditorByTokenService(ctx: QueryCtx, token: UserIdentity["tokenIdentifier"]) {
	return okOrThrow(
		ctx.db
			.query("editorProfiles")
			.withIndex("by_tokenIdentifier", (query) => query.eq("tokenIdentifier", token))
			.unique()
	);
}

export function getCurrentUserAccessService(ctx: QueryCtx) {
	return okOrThrow(ctx.auth.getUserIdentity())
		.andThen(requireAuthenticatedIdentity)
		.andThen((identity) =>
			resolveUserAccess(identity, (token) => getEditorByTokenService(ctx, token))
		);
}
