import { accessForIdentity } from "#convex/shared/lib/authPermissionsSteps";
import { requireUser } from "#convex/shared/services/authIdentity";
import type { UserIdentity } from "convex/server";
import { ok, safeTry, type ResultAsync } from "neverthrow";
import type { Doc } from "#convex/_generated/dataModel";
import type { QueryCtx } from "#convex/_generated/server";
import { getEditorByToken, type UserAccess, verifyUserPermission } from "#convex/shared/lib/auth";
import type { Permission } from "#/lib/permissions";

function authorizeIdentityForPermission(
	loadEditor: (
		token: UserIdentity["tokenIdentifier"]
	) => ResultAsync<Doc<"editorProfiles"> | null, never>,
	permission: Permission,

	identity: UserIdentity
) {
	return safeTry(async function* () {
		const access: UserAccess = yield* getUserRoleAndPermissions(identity, loadEditor);
		yield* verifyUserPermission(permission, access);

		return ok(identity);
	});
}

function getUserRoleAndPermissions(
	identity: UserIdentity,
	loadEditor: (
		token: UserIdentity["tokenIdentifier"]
	) => ResultAsync<Doc<"editorProfiles"> | null, never>
): ResultAsync<UserAccess, { reason: "NOT_AUTHORIZED" }> {
	return safeTry(async function* () {
		const editor = yield* loadEditor(identity.tokenIdentifier);
		const access = yield* accessForIdentity(identity, editor);

		return ok(access);
	});
}

export function requireUserPermission(
	auth: QueryCtx["auth"],
	loadEditor: (
		token: UserIdentity["tokenIdentifier"]
	) => ResultAsync<Doc<"editorProfiles"> | null, never>,
	permission: Permission
) {
	return safeTry(async function* () {
		const identity: UserIdentity = yield* requireUser({ auth });
		yield* authorizeIdentityForPermission(loadEditor, permission, identity);

		return ok(identity);
	});
}

export function loadUserAccessForIdentity(ctx: QueryCtx, identity: UserIdentity) {
	return getUserRoleAndPermissions(identity, (token) => getEditorByToken(ctx, token));
}
