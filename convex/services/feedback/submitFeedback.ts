"use node";

import type { ActionCtx } from "#convex/_generated/server";
import { sendFeedbackEmailForMessage } from "#convex/services/feedback/feedbackEmail";
import { parseFeedbackMessage } from "#convex/lib/feedback";
import { checkFeedbackSubmitRateLimit } from "#convex/lib/rateLimits";

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
