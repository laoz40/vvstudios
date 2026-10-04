"use node";

import { v } from "convex/values";
import { action } from "#convex/_generated/server";
import { sendFeedbackEmailForMessage } from "#convex/lib/email/email";
import { parseFeedbackMessage } from "#convex/lib/feedback";
import { checkFeedbackSubmitRateLimit } from "#convex/lib/rateLimits";
import { tupleErr, tupleOk } from "#/lib/result";

export const submit = action({
	args: { message: v.string() },
	handler: (ctx, args) =>
		parseFeedbackMessage(args.message)
			.asyncAndThen((message) => checkFeedbackSubmitRateLimit(ctx).map(() => message))
			.andThen(sendFeedbackEmailForMessage)
			.map(() => null)
			.match(tupleOk, tupleErr)
});
