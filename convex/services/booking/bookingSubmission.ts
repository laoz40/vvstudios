import { internal } from "#convex/_generated/api";
import type { ActionCtx } from "#convex/_generated/server";
import { getBookingSubmitRateLimitKey } from "#convex/lib/booking/bookingSubmission";
import { fromConvexTuple } from "#convex/lib/result";

function checkPackageSubmitRateLimitForKey(ctx: ActionCtx, submitRateLimitKey: string) {
	return fromConvexTuple(
		ctx.runMutation(internal.packages.checkPackageSubmitRateLimit, { submitRateLimitKey })
	);
}

export function checkPackageSubmitRateLimit(ctx: ActionCtx, email: string) {
	return getBookingSubmitRateLimitKey(email).andThen((submitRateLimitKey: string) =>
		checkPackageSubmitRateLimitForKey(ctx, submitRateLimitKey)
	);
}
