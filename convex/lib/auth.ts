import type { UserIdentity } from "convex/server";
import { err, ok } from "../../src/lib/result";

export const ADMIN_ROLE = "admin";

type AuthContext = { auth: { getUserIdentity: () => Promise<UserIdentity | null> } };

type PublicMetadata = { role?: string };

function getPublicMetadata(identity: UserIdentity): PublicMetadata | null {
	const publicMetadata = identity.publicMetadata;

	if (!publicMetadata || typeof publicMetadata !== "object" || Array.isArray(publicMetadata)) {
		return null;
	}

	return publicMetadata as PublicMetadata;
}

export function isAdminIdentity(identity: UserIdentity): boolean {
	return getPublicMetadata(identity)?.role === ADMIN_ROLE;
}

export async function getAdminIdentity(ctx: AuthContext) {
	const identity = await ctx.auth.getUserIdentity();

	if (!identity) {
		return err({ reason: "NOT_AUTHENTICATED" });
	}

	if (!isAdminIdentity(identity)) {
		return err({ reason: "NOT_AUTHORIZED" });
	}

	return ok(identity);
}
