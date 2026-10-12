import type { QueryCtx } from "#convex/_generated/server";
import { ok, safeTry } from "neverthrow";
import { getUserIdentity, requireAuthenticatedIdentity } from "#convex/shared/lib/auth";

export function requireUser(ctx: Pick<QueryCtx, "auth">) {
	return safeTry(async function* () {
		const identity = yield* getUserIdentity(ctx);
		const authenticatedIdentity = yield* requireAuthenticatedIdentity(identity);

		return ok(authenticatedIdentity);
	});
}
