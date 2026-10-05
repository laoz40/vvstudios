import { internal } from "#convex/_generated/api";
import type { ActionCtx } from "#convex/_generated/server";
import { getBookingSubmitRateLimitKey } from "#convex/lib/booking/bookingSubmission";
import { fromConvexTuple } from "#convex/lib/result";

function checkPackageSubmitRateLimitForKey(ctx: ActionCtx) {
	return (submitRateLimitKey: string) =>
		fromConvexTuple(
			ctx.runMutation(internal.packages.checkPackageSubmitRateLimit, { submitRateLimitKey })
		);
}

export function checkPackageSubmitRateLimit(ctx: ActionCtx, email: string) {
	return getBookingSubmitRateLimitKey(email).andThen(checkPackageSubmitRateLimitForKey(ctx));
}
