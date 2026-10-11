import { checkPackageSubmitRateLimitForKey } from "#convex/booking/lib/submissionRateLimit";

import type { ActionCtx } from "#convex/_generated/server";
import { getBookingSubmitRateLimitKey } from "#convex/booking/lib/submission";

export function checkPackageSubmitRateLimit(ctx: ActionCtx, email: string) {
	return getBookingSubmitRateLimitKey(email).andThen((submitRateLimitKey: string) =>
		checkPackageSubmitRateLimitForKey(ctx, submitRateLimitKey)
	);
}
