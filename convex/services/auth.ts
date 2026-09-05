import { ok } from "neverthrow";
import type { MutationCtx, QueryCtx } from "#convex/_generated/server";
import {
	getEditorByToken,
	getUserRoleAndPermissions,
	isAdminIdentity,
	requireUser,
	saveEditorDetails
} from "#convex/lib/auth";
export function getCurrentUserAccessService(ctx: QueryCtx) {
	return requireUser(ctx).andThen((identity) =>
		getUserRoleAndPermissions(identity, (token) => getEditorByToken(ctx, token))
	);
}

export function createEditorUserService(ctx: MutationCtx) {
	return requireUser(ctx).andThen((identity) => {
		if (isAdminIdentity(identity)) {
			return ok(null);
		}

		return getEditorByToken(ctx, identity.tokenIdentifier).andThen((editor) =>
			saveEditorDetails(ctx, identity, editor)
		);
	});
}
