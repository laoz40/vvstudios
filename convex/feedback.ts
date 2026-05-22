import { ConvexError, v } from "convex/values";
import { action } from "./_generated/server";
import { sendFeedbackEmailForMessage } from "./lib/email";
import { rateLimiter } from "./lib/rateLimits";

type SubmitFeedbackErrorData = {
	code: "INVALID_MESSAGE" | "FEEDBACK_RATE_LIMITED" | "SEND_FAILED";
};

export const submit = action({
	args: {
		message: v.string(),
	},
	handler: async (ctx, args): Promise<null> => {
		const message = args.message.trim();

		if (!message) {
			throw new ConvexError<SubmitFeedbackErrorData>({ code: "INVALID_MESSAGE" });
		}

		const rateLimitStatus = await rateLimiter.limit(ctx, "feedbackSubmitGlobal");

		if (!rateLimitStatus.ok) {
			throw new ConvexError<SubmitFeedbackErrorData>({ code: "FEEDBACK_RATE_LIMITED" });
		}

		try {
			await sendFeedbackEmailForMessage(message);
		} catch {
			throw new ConvexError<SubmitFeedbackErrorData>({ code: "SEND_FAILED" });
		}

		return null;
	},
});
