import type { UserIdentity } from "convex/server";
import { err, ok, type ResultAsync } from "neverthrow";
import { z } from "zod";
import { internal } from "#convex/_generated/api";
import type { Doc } from "#convex/_generated/dataModel";
import type { ActionCtx, MutationCtx, QueryCtx } from "#convex/_generated/server";
import { fromConvexTuple, okOrThrow } from "#convex/lib/result";
import { hasPermission, ROLE_PERMISSIONS, type Permission } from "#/lib/permissions";

export const ADMIN_ROLE = "admin";

type PublicMetadata = { role?: string };

type AdminEditorProfile = { tokenIdentifier: string; displayName: string; isActive: boolean };

type UserAccess =
	| { role: "admin"; permissions: readonly Permission[]; editorProfile: AdminEditorProfile | null }
	| { role: "editor"; permissions: readonly Permission[] };

const publicMetadataSchema = z.object({ role: z.string().optional() });

function getPublicMetadata(identity: UserIdentity): PublicMetadata | null {
	const parsedMetadata = publicMetadataSchema.safeParse(identity.publicMetadata);

	return parsedMetadata.success ? parsedMetadata.data : null;
}

export function isAdminIdentity(identity: UserIdentity): boolean {
	return getPublicMetadata(identity)?.role === ADMIN_ROLE;
}

export function requireAdminIdentity(identity: UserIdentity) {
	if (!isAdminIdentity(identity)) {
		return err({ reason: "NOT_AUTHORIZED" as const });
	}

	return ok(identity);
}

export function requireEnrollableEditorProfile(editor: Doc<"editorProfiles"> | null) {
	if (editor !== null && !editor.isActive) {
		return err({ reason: "EDITOR_PROFILE_INACTIVE" as const });
	}

	return ok(editor);
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

function buildAdminEditorProfile(editor: Doc<"editorProfiles">): AdminEditorProfile {
	return {
		tokenIdentifier: editor.tokenIdentifier,
		displayName: editor.displayName,
		isActive: editor.isActive
	};
}

export function getUserRoleAndPermissions(
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
				// Authentication is invite-only, so a newly authenticated user is an approved editor.
				isActive: true,
				lastAssignedAt: null,
				totalEdits: 0
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
