import type { UserIdentity } from "convex/server";
import { err, ok } from "neverthrow";
import { okOrThrow } from "#convex/lib/result";

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

export function getAdminIdentity(ctx: AuthContext) {
	return okOrThrow(ctx.auth.getUserIdentity()).andThen((identity) => {
		if (!identity) {
			return err({ reason: "NOT_AUTHENTICATED" as const });
		}

		if (!isAdminIdentity(identity)) {
			return err({ reason: "NOT_AUTHORIZED" as const });
		}

		return ok(identity);
	});
}
