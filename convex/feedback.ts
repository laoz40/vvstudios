import { v } from "convex/values";
import { action, type ActionCtx } from "./_generated/server";
import { err, ok } from "../src/lib/result";
import { sendFeedbackEmailForMessage } from "./lib/email";
import { rateLimiter } from "./lib/rateLimits";

type SubmitFeedbackArgs = { message: string };

export const submit = action({
	args: { message: v.string() },
	handler: (ctx, args) => submitFeedbackHandler(ctx, args)
});

async function submitFeedbackHandler(ctx: ActionCtx, args: SubmitFeedbackArgs) {
	const message = args.message.trim();

	if (!message) {
		return err({ reason: "INVALID_MESSAGE" });
	}

	const rateLimitStatus = await rateLimiter.limit(ctx, "feedbackSubmitGlobal");

	if (!rateLimitStatus.ok) {
		return err({ reason: "FEEDBACK_RATE_LIMITED" });
	}

	const [emailError] = await sendFeedbackEmailForMessage(message);

	if (emailError !== null) {
		console.error("Feedback email send failed", { reason: emailError.reason });
		return err({ reason: "SEND_FAILED" });
	}

	return ok({ submitted: true });
}

export type SubmitFeedbackResult = Awaited<ReturnType<typeof submitFeedbackHandler>>;
