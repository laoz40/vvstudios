import type { UserIdentity } from "convex/server";
import { err, ok } from "neverthrow";
import { okOrThrow } from "#convex/lib/result";
import { hasPermission, ROLE_PERMISSIONS, type Permission } from "#/lib/permissions";

export const ADMIN_ROLE = "admin";

type AuthContext = { auth: { getUserIdentity: () => Promise<UserIdentity | null> } };

type PublicMetadata = { role?: string };

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

export function requirePermission(ctx: AuthContext, permission: Permission) {
	return okOrThrow(ctx.auth.getUserIdentity()).andThen((identity) => {
		if (!identity) {
			return err({ reason: "NOT_AUTHENTICATED" as const });
		}

		// Editor access resolution is added in a later slice; non-admin behavior stays unchanged here.
		if (!isAdminIdentity(identity) || !hasPermission(ROLE_PERMISSIONS.admin, permission)) {
			return err({ reason: "NOT_AUTHORIZED" as const });
		}

		return ok(identity);
	});
}
