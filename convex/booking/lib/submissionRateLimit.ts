import { internal } from "#convex/_generated/api";
import type { ActionCtx } from "#convex/_generated/server";
import { fromConvexTuple } from "#convex/shared/lib/result";

export function checkPackageSubmitRateLimitForKey(ctx: ActionCtx, submitRateLimitKey: string) {
	return fromConvexTuple(
		ctx.runMutation(internal.packages.admin.checkPackageSubmitRateLimit, { submitRateLimitKey })
	);
}
