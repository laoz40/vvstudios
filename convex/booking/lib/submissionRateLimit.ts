import type { ResultAsync } from "neverthrow";
import { internal } from "#convex/_generated/api";
import type { ActionCtx } from "#convex/_generated/server";
import { fromConvexTuple } from "#convex/shared/lib/result";
import type { BookingSubmitRateLimitError } from "#convex/shared/lib/rateLimits";

export function checkPackageSubmitRateLimitForKey(
	ctx: ActionCtx,
	submitRateLimitKey: string
): ResultAsync<null, BookingSubmitRateLimitError> {
	return fromConvexTuple(
		ctx.runMutation(internal.packages.admin.checkPackageSubmitRateLimit, { submitRateLimitKey })
	);
}
