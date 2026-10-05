import type { UserIdentity } from "convex/server";
import { err, ok, type ResultAsync } from "neverthrow";
import { internal } from "#convex/_generated/api";
import type { Doc } from "#convex/_generated/dataModel";
import type { ActionCtx, MutationCtx, QueryCtx } from "#convex/_generated/server";
import {
	getEditorByToken,
	isAdminIdentity,
	requireEnrollableEditorProfile,
	requireUser,
	saveEditorDetails
} from "#convex/lib/auth";
import { fromConvexTuple } from "#convex/lib/result";
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

export function loadUserAccessForIdentity(ctx: QueryCtx, identity: UserIdentity) {
	return getUserRoleAndPermissions(identity, (token) => getEditorByToken(ctx, token));
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
