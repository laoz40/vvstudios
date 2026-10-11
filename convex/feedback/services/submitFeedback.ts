"use node";

import type { ActionCtx } from "#convex/_generated/server";
import { parseFeedbackMessage } from "#convex/feedback/lib/feedback";
import { sendFeedbackEmailForMessage } from "#convex/feedback/lib/feedbackEmail";
import { checkFeedbackSubmitRateLimit } from "#convex/shared/services/rateLimits";

export function submitFeedbackMessage(ctx: ActionCtx, message: string) {
	return parseFeedbackMessage(message)
		.asyncAndThen((parsed) =>
			checkFeedbackSubmitRateLimit(ctx).andThen(() => sendFeedbackEmailForMessage(parsed))
		)
		.map(() => null);
}
