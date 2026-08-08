"use node";

import { err, errAsync, ok, type ResultAsync } from "neverthrow";
import { v } from "convex/values";
import { action, type ActionCtx } from "./_generated/server";
import { tupleErr, tupleOk } from "#/lib/result";
import { sendFeedbackEmailForMessage } from "./lib/email";
import { rateLimiter } from "./lib/rateLimits";
import { okOrThrow } from "./lib/result";

type SubmitFeedbackArgs = { message: string };
type SubmitFeedbackError =
	| { reason: "INVALID_MESSAGE" }
	| { reason: "FEEDBACK_RATE_LIMITED" }
	| { reason: "SEND_FAILED" };

export const submit = action({
	args: { message: v.string() },
	handler: (ctx, args) => submitFeedbackService(ctx, args).match(tupleOk, tupleErr)
});

function submitFeedbackService(
	ctx: ActionCtx,
	args: SubmitFeedbackArgs
): ResultAsync<{ submitted: true }, SubmitFeedbackError> {
	const message = args.message.trim();

	if (!message) {
		return errAsync({ reason: "INVALID_MESSAGE" as const });
	}

	return okOrThrow(rateLimiter.limit(ctx, "feedbackSubmitGlobal"))
		.andThen((rateLimitStatus) =>
			rateLimitStatus.ok ? ok(null) : err({ reason: "FEEDBACK_RATE_LIMITED" as const })
		)
		.andThen(() =>
			okOrThrow(sendFeedbackEmailForMessage(message)).andThen((emailResult) => emailResult)
		)
		.map(() => ({ submitted: true as const }))
		.mapErr((emailError) => {
			if (emailError.reason !== "FEEDBACK_RATE_LIMITED") {
				console.error("Feedback email send failed", { reason: emailError.reason });
				return { reason: "SEND_FAILED" as const };
			}

			return emailError;
		});
}
