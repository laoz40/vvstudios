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

function requireAuthenticatedIdentity(identity: UserIdentity | null) {
	if (identity === null) {
		return err({ reason: "NOT_AUTHENTICATED" as const });
	}

	return ok(identity);
}

export function requireUser(ctx: Pick<QueryCtx, "auth">) {
	return okOrThrow(ctx.auth.getUserIdentity()).andThen(requireAuthenticatedIdentity);
}

export function getUserRoleAndPermissions(
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
	return requireUser({ auth }).andThen((identity) =>
		getUserRoleAndPermissions(identity, loadEditor).andThen((access) => {
			if (!hasPermission(access.permissions, permission)) {
				return err({ reason: "NOT_AUTHORIZED" as const });
			}

			return ok(identity);
		})
	);
}

export function getEditorByToken(
	ctx: QueryCtx | MutationCtx,
	token: UserIdentity["tokenIdentifier"]
) {
	return okOrThrow(
		ctx.db
			.query("editorProfiles")
			.withIndex("by_tokenIdentifier", (query) => query.eq("tokenIdentifier", token))
			.unique()
	);
}

export function saveEditorDetails(
	ctx: MutationCtx,
	identity: UserIdentity,
	editor: Doc<"editorProfiles"> | null
) {
	const details = { displayName: identity.name ?? "", email: identity.email ?? "" };
	if (editor !== null) {
		return okOrThrow(ctx.db.patch(editor._id, details).then(() => null));
	}

	return okOrThrow(
		ctx.db
			.insert("editorProfiles", {
				...details,
				tokenIdentifier: identity.tokenIdentifier,
				isActive: true
			})
			.then(() => null)
	);
}

export function requirePermission(ctx: QueryCtx | MutationCtx, permission: Permission) {
	return requireUserPermission(ctx.auth, (token) => getEditorByToken(ctx, token), permission);
}

export function requirePermissionActions(ctx: ActionCtx, permission: Permission) {
	return requireUserPermission(
		ctx.auth,
		(token) => fromConvexTuple(ctx.runQuery(internal.auth.getEditorByToken, { token })),
		permission
	);
}
