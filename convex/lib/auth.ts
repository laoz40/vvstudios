import type { UserIdentity } from "convex/server";
import { err, ok, okAsync, type ResultAsync } from "neverthrow";
import { internal } from "#convex/_generated/api";
import type { Doc } from "#convex/_generated/dataModel";
import type { ActionCtx, MutationCtx, QueryCtx } from "#convex/_generated/server";
import { fromConvexTuple, okOrThrow } from "#convex/lib/result";
import { hasPermission, ROLE_PERMISSIONS, type Permission, type Role } from "#/lib/permissions";

export const ADMIN_ROLE = "admin";

type PublicMetadata = { role?: string };
type UserAccess = { role: Role; permissions: readonly Permission[] };

function getPublicMetadata(identity: UserIdentity): PublicMetadata | null {
	const publicMetadata = identity.publicMetadata;

	if (!publicMetadata || typeof publicMetadata !== "object" || Array.isArray(publicMetadata)) {
		return null;
	}

	return publicMetadata;
}

export function isAdminIdentity(identity: UserIdentity): boolean {
	return getPublicMetadata(identity)?.role === ADMIN_ROLE;
}

export function requireAuthenticatedIdentity(identity: UserIdentity | null) {
	if (identity === null) {
		return err({ reason: "NOT_AUTHENTICATED" as const });
	}

	return ok(identity);
}

export function resolveUserAccess(
	identity: UserIdentity,
	loadEditor: (
		token: UserIdentity["tokenIdentifier"]
	) => ResultAsync<Doc<"editorProfiles"> | null, never>
): ResultAsync<UserAccess, { reason: "NOT_AUTHORIZED" }> {
	if (isAdminIdentity(identity)) {
		return okAsync({ role: "admin", permissions: ROLE_PERMISSIONS.admin });
	}

	return loadEditor(identity.tokenIdentifier).andThen((editor) => {
		if (editor === null || !editor.isActive) {
			return err({ reason: "NOT_AUTHORIZED" as const });
		}

		return ok({ role: "editor" as const, permissions: ROLE_PERMISSIONS.editor });
	});
}

function requireUserPermission(
	auth: QueryCtx["auth"],
	loadEditor: (
		token: UserIdentity["tokenIdentifier"]
	) => ResultAsync<Doc<"editorProfiles"> | null, never>,
	permission: Permission
) {
	return okOrThrow(auth.getUserIdentity())
		.andThen(requireAuthenticatedIdentity)
		.andThen((identity) =>
			resolveUserAccess(identity, loadEditor).andThen((access) => {
				if (!hasPermission(access.permissions, permission)) {
					return err({ reason: "NOT_AUTHORIZED" as const });
				}

				return ok(identity);
			})
		);
}

export function requirePermission(ctx: QueryCtx | MutationCtx, permission: Permission) {
	return requireUserPermission(
		ctx.auth,
		(token) =>
			okOrThrow(
				ctx.db
					.query("editorProfiles")
					.withIndex("by_tokenIdentifier", (query) => query.eq("tokenIdentifier", token))
					.unique()
			),
		permission
	);
}

export function requirePermissionActions(ctx: ActionCtx, permission: Permission) {
	return requireUserPermission(
		ctx.auth,
		(token) => fromConvexTuple(ctx.runQuery(internal.auth.getEditorByToken, { token })),
		permission
	);
}
