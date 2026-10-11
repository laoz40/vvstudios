import type { QueryCtx } from "#convex/_generated/server";
import { getUserIdentity, requireAuthenticatedIdentity } from "#convex/shared/lib/auth";

export function requireUser(ctx: Pick<QueryCtx, "auth">) {
	return getUserIdentity(ctx).andThen(requireAuthenticatedIdentity);
}
