import type { UserIdentity } from "convex/server";
import { type ResultAsync } from "neverthrow";
import type { Doc } from "#convex/_generated/dataModel";
import type { QueryCtx } from "#convex/_generated/server";
import {
	adminUserAccessFromEditor,
	editorUserAccessFromProfile,
	getEditorByToken,
	isAdminIdentity,
	requireUser,
	type UserAccess,
	verifyUserPermission
} from "#convex/shared/lib/auth";
import type { Permission } from "#/lib/permissions";

function identityAfterPermissionCheck(identity: UserIdentity, _access: UserAccess) {
	return identity;
}

function authorizeIdentityForPermission(
	loadEditor: (
		token: UserIdentity["tokenIdentifier"]
	) => ResultAsync<Doc<"editorProfiles"> | null, never>,
	permission: Permission,

	identity: UserIdentity
) {
	return getUserRoleAndPermissions(identity, loadEditor)
		.andThen((access: UserAccess) => verifyUserPermission(permission, access))
		.map((_access: UserAccess) => identityAfterPermissionCheck(identity, _access));
}

function getUserRoleAndPermissions(
	identity: UserIdentity,
	loadEditor: (
		token: UserIdentity["tokenIdentifier"]
	) => ResultAsync<Doc<"editorProfiles"> | null, never>
): ResultAsync<UserAccess, { reason: "NOT_AUTHORIZED" }> {
	if (isAdminIdentity(identity)) {
		return loadEditor(identity.tokenIdentifier).map(adminUserAccessFromEditor);
	}

	return loadEditor(identity.tokenIdentifier).andThen(editorUserAccessFromProfile);
}

export function requireUserPermission(
	auth: QueryCtx["auth"],
	loadEditor: (
		token: UserIdentity["tokenIdentifier"]
	) => ResultAsync<Doc<"editorProfiles"> | null, never>,
	permission: Permission
) {
	return requireUser({ auth }).andThen((identity: UserIdentity) =>
		authorizeIdentityForPermission(loadEditor, permission, identity)
	);
}

export function loadUserAccessForIdentity(ctx: QueryCtx, identity: UserIdentity) {
	return getUserRoleAndPermissions(identity, (token) => getEditorByToken(ctx, token));
}
