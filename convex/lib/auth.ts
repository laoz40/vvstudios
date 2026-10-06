import type { UserIdentity } from "convex/server";
import { err, ok, okAsync, type Result } from "neverthrow";
import { z } from "zod";
import type { Doc } from "#convex/_generated/dataModel";
import { hasPermission, ROLE_PERMISSIONS, type Permission } from "#/lib/permissions";
import type { MutationCtx, QueryCtx } from "#convex/_generated/server";
import {
	editorProfileDisplayName,
	writeBookingsAssignedEditorDisplayName
} from "#convex/lib/editor/editorAssignments";
import { okOrThrow } from "#convex/lib/result";

export const ADMIN_ROLE = "admin";

type AdminEditorProfile = { tokenIdentifier: string; displayName: string; isActive: boolean };

export type UserAccess =
	| { role: "admin"; permissions: readonly Permission[]; editorProfile: AdminEditorProfile | null }
	| { role: "editor"; permissions: readonly Permission[] };

type PublicMetadata = { role?: string };

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

function buildAdminEditorProfile(editor: Doc<"editorProfiles">): AdminEditorProfile {
	return {
		tokenIdentifier: editor.tokenIdentifier,
		displayName: editor.displayName,
		isActive: editor.isActive
	};
}

export function adminUserAccessFromEditor(editor: Doc<"editorProfiles"> | null): UserAccess {
	return {
		role: "admin",
		permissions: ROLE_PERMISSIONS.admin,
		editorProfile: editor === null ? null : buildAdminEditorProfile(editor)
	};
}

export function editorUserAccessFromProfile(
	editor: Doc<"editorProfiles"> | null
): Result<UserAccess, { reason: "NOT_AUTHORIZED" }> {
	if (editor === null || !editor.isActive) {
		return err({ reason: "NOT_AUTHORIZED" as const });
	}

	return ok({ role: "editor" as const, permissions: ROLE_PERMISSIONS.editor });
}

export function verifyUserPermission(permission: Permission, access: UserAccess) {
	if (!hasPermission(access.permissions, permission)) {
		return err({ reason: "NOT_AUTHORIZED" as const });
	}

	return ok(access);
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
		const nextAssignedEditorDisplayName = editorProfileDisplayName(details);
		const previousAssignedEditorDisplayName = editorProfileDisplayName(editor);

		return okOrThrow(ctx.db.patch("editorProfiles", editor._id, details).then(() => null)).andThen(
			() => {
				if (nextAssignedEditorDisplayName === previousAssignedEditorDisplayName) {
					return okAsync(null);
				}

				return writeBookingsAssignedEditorDisplayName(
					ctx,
					editor.tokenIdentifier,
					nextAssignedEditorDisplayName
				);
			}
		);
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
