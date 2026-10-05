import type { UserIdentity } from "convex/server";
import { ok } from "neverthrow";
import type { MutationCtx, QueryCtx } from "#convex/_generated/server";
import {
	getEditorByToken as getEditorByTokenLib,
	isAdminIdentity,
	requireAdminIdentity as requireAdminIdentityLib,
	requireEnrollableEditorProfile,
	requireUser as requireUserLib,
	saveEditorDetails
} from "#convex/lib/auth";
import type { Permission } from "#/lib/permissions";
import {
	loadUserAccessForIdentity as loadUserAccessForIdentityLib,
	requireUserPermission
} from "#convex/services/authPermissions";

export function requirePermission(ctx: QueryCtx | MutationCtx, permission: Permission) {
	return requireUserPermission(ctx.auth, (token) => getEditorByTokenLib(ctx, token), permission);
}

export function saveSignedInEditorProfile(ctx: MutationCtx, identity: UserIdentity) {
	if (isAdminIdentity(identity)) {
		return ok(null);
	}

	return getEditorByTokenLib(ctx, identity.tokenIdentifier).andThen((editor) =>
		saveEditorDetails(ctx, identity, editor)
	);
}

export function saveAdminEditorEnrollment(ctx: MutationCtx, identity: UserIdentity) {
	return getEditorByTokenLib(ctx, identity.tokenIdentifier)
		.andThen(requireEnrollableEditorProfile)
		.andThen((editor) => saveEditorDetails(ctx, identity, editor));
}

export function getEditorByToken(ctx: QueryCtx | MutationCtx, token: string) {
	return getEditorByTokenLib(ctx, token);
}

export function requireAdminIdentity(identity: UserIdentity) {
	return requireAdminIdentityLib(identity);
}

export function requireUser(ctx: QueryCtx | MutationCtx) {
	return requireUserLib(ctx);
}

export function loadUserAccessForIdentity(ctx: QueryCtx | MutationCtx, identity: UserIdentity) {
	return loadUserAccessForIdentityLib(ctx, identity);
}
