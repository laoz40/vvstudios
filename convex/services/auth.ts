import type { UserIdentity } from "convex/server";
import { ok } from "neverthrow";
import type { MutationCtx, QueryCtx } from "#convex/_generated/server";
import {
	getEditorByToken,
	isAdminIdentity,
	requireEnrollableEditorProfile,
	saveEditorDetails
} from "#convex/lib/auth";
import type { Permission } from "#/lib/permissions";
import { requireUserPermission } from "#convex/services/authPermissions";

export function requirePermission(ctx: QueryCtx | MutationCtx, permission: Permission) {
	return requireUserPermission(ctx.auth, (token) => getEditorByToken(ctx, token), permission);
}

export function saveSignedInEditorProfile(ctx: MutationCtx, identity: UserIdentity) {
	if (isAdminIdentity(identity)) {
		return ok(null);
	}

	return getEditorByToken(ctx, identity.tokenIdentifier).andThen((editor) =>
		saveEditorDetails(ctx, identity, editor)
	);
}

export function saveAdminEditorEnrollment(ctx: MutationCtx, identity: UserIdentity) {
	return getEditorByToken(ctx, identity.tokenIdentifier)
		.andThen(requireEnrollableEditorProfile)
		.andThen((editor) => saveEditorDetails(ctx, identity, editor));
}

export { getEditorByToken, requireAdminIdentity, requireUser } from "#convex/lib/auth";

export { loadUserAccessForIdentity } from "#convex/services/authPermissions";
