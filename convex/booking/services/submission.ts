import { ok, safeTry } from "neverthrow";
import { checkPackageSubmitRateLimitForKey } from "#convex/booking/lib/submissionRateLimit";

import type { ActionCtx } from "#convex/_generated/server";
import { getBookingSubmitRateLimitKey } from "#convex/booking/lib/submission";

export function checkPackageSubmitRateLimit(ctx: ActionCtx, email: string) {
	return safeTry(async function* () {
		const submitRateLimitKey = yield* getBookingSubmitRateLimitKey(email);
		const result = yield* checkPackageSubmitRateLimitForKey(ctx, submitRateLimitKey);

		return ok(result);
	});
}
