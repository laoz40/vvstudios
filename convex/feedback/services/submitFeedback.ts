"use node";

import type { ActionCtx } from "#convex/_generated/server";
import { ok, safeTry } from "neverthrow";
import { parseFeedbackMessage } from "#convex/feedback/lib/feedback";
import { sendFeedbackEmailForMessage } from "#convex/feedback/lib/feedbackEmail";
import { checkFeedbackSubmitRateLimit } from "#convex/shared/services/rateLimits";

export function submitFeedbackMessage(ctx: ActionCtx, message: string) {
	return safeTry(async function* () {
		const parsed = yield* parseFeedbackMessage(message);
		yield* checkFeedbackSubmitRateLimit(ctx);
		yield* sendFeedbackEmailForMessage(parsed);

		return ok(null);
	});
}
