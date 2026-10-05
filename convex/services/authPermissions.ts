import type { UserIdentity } from "convex/server";
import { err, ok, type ResultAsync } from "neverthrow";
import type { Doc } from "#convex/_generated/dataModel";
import type { QueryCtx } from "#convex/_generated/server";
import { getEditorByToken, isAdminIdentity, requireUser } from "#convex/lib/auth";
import { hasPermission, ROLE_PERMISSIONS, type Permission } from "#/lib/permissions";

type AdminEditorProfile = { tokenIdentifier: string; displayName: string; isActive: boolean };

type UserAccess =
	| { role: "admin"; permissions: readonly Permission[]; editorProfile: AdminEditorProfile | null }
	| { role: "editor"; permissions: readonly Permission[] };

function buildAdminEditorProfile(editor: Doc<"editorProfiles">): AdminEditorProfile {
	return {
		tokenIdentifier: editor.tokenIdentifier,
		displayName: editor.displayName,
		isActive: editor.isActive
	};
}

function getUserRoleAndPermissions(
	identity: UserIdentity,
	loadEditor: (
		token: UserIdentity["tokenIdentifier"]
	) => ResultAsync<Doc<"editorProfiles"> | null, never>
): ResultAsync<UserAccess, { reason: "NOT_AUTHORIZED" }> {
	if (isAdminIdentity(identity)) {
		return loadEditor(identity.tokenIdentifier).map((editor) => ({
			role: "admin" as const,
			permissions: ROLE_PERMISSIONS.admin,
			editorProfile: editor === null ? null : buildAdminEditorProfile(editor)
		}));
	}

	return loadEditor(identity.tokenIdentifier).andThen((editor) => {
		if (editor === null || !editor.isActive) {
			return err({ reason: "NOT_AUTHORIZED" as const });
		}

		return ok({ role: "editor" as const, permissions: ROLE_PERMISSIONS.editor });
	});
}

export function requireUserPermission(
	auth: QueryCtx["auth"],
	loadEditor: (
		token: UserIdentity["tokenIdentifier"]
	) => ResultAsync<Doc<"editorProfiles"> | null, never>,
	permission: Permission
) {
	return requireUser({ auth }).andThen((identity) =>
		getUserRoleAndPermissions(identity, loadEditor).andThen((access) => {
			if (!hasPermission(access.permissions, permission)) {
				return err({ reason: "NOT_AUTHORIZED" as const });
			}

			return ok(identity);
		})
	);
}

export function loadUserAccessForIdentity(ctx: QueryCtx, identity: UserIdentity) {
	return getUserRoleAndPermissions(identity, (token) => getEditorByToken(ctx, token));
}
