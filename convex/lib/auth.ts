import type { UserIdentity } from "convex/server";
import { ConvexError } from "convex/values";

export const ADMIN_ROLE = "admin";

type AuthContext = {
	auth: {
		getUserIdentity: () => Promise<UserIdentity | null>;
	};
};

type PublicMetadata = {
	role?: string;
};

type AuthErrorData = {
	code: "NOT_AUTHENTICATED" | "NOT_AUTHORIZED";
};

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

export async function requireAdmin(ctx: AuthContext) {
	const identity = await ctx.auth.getUserIdentity();

	if (!identity) {
		throw new ConvexError<AuthErrorData>({ code: "NOT_AUTHENTICATED" });
	}

	if (!isAdminIdentity(identity)) {
		throw new ConvexError<AuthErrorData>({ code: "NOT_AUTHORIZED" });
	}

	return identity;
}
