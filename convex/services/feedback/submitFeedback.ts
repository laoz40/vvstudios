"use node";

import { errAsync, type ResultAsync } from "neverthrow";
import type { ActionCtx } from "#convex/_generated/server";
import { sendFeedbackEmailForMessage } from "#convex/lib/email/email";
import { checkFeedbackSubmitRateLimit } from "#convex/lib/rateLimits";
import { okOrThrow } from "#convex/lib/result";

export type SubmitFeedbackArgs = { message: string };

export type SubmitFeedbackError =
	| { reason: "INVALID_MESSAGE" }
	| { reason: "FEEDBACK_RATE_LIMITED" }
	| { reason: "EMAIL_REQUEST_FAILED" }
	| { reason: "EMAIL_RESPONSE_FAILED" };

export function submitFeedbackService(
	ctx: ActionCtx,
	args: SubmitFeedbackArgs
): ResultAsync<null, SubmitFeedbackError> {
	const message = args.message.trim();

	if (!message) {
		return errAsync({ reason: "INVALID_MESSAGE" as const });
	}

	return checkFeedbackSubmitRateLimit(ctx).andThen(() =>
		okOrThrow(sendFeedbackEmailForMessage(message)).andThen((emailResult) => emailResult)
	);
}
