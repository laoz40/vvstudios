"use node";

import type { ActionCtx } from "#convex/_generated/server";
import { sendFeedbackEmailForMessage } from "#convex/lib/email/email";
import { parseFeedbackMessage } from "#convex/lib/feedback";
import { checkFeedbackSubmitRateLimit } from "#convex/lib/rateLimits";

export function submitFeedbackMessage(ctx: ActionCtx, message: string) {
	return parseFeedbackMessage(message)
		.asyncAndThen((parsed) => checkFeedbackSubmitRateLimit(ctx).map(() => parsed))
		.andThen(sendFeedbackEmailForMessage)
		.map(() => null);
}
