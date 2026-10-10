"use node";

import type { ActionCtx } from "#convex/_generated/server";
import { parseFeedbackMessage } from "#convex/feedback/lib/feedback";
import { sendFeedbackEmailForMessage } from "#convex/feedback/services/feedbackEmail";
import { checkFeedbackSubmitRateLimit } from "#convex/shared/lib/rateLimits";

function passthroughValue<T>(value: T) {
	return value;
}

function passMessageAfterFeedbackRateLimit(ctx: ActionCtx, parsed: string) {
	return checkFeedbackSubmitRateLimit(ctx).map(() => passthroughValue(parsed));
}

function feedbackSubmitComplete() {
	return null;
}

export function submitFeedbackMessage(ctx: ActionCtx, message: string) {
	return parseFeedbackMessage(message)
		.asyncAndThen((parsed: string) => passMessageAfterFeedbackRateLimit(ctx, parsed))
		.andThen(sendFeedbackEmailForMessage)
		.map(feedbackSubmitComplete);
}
