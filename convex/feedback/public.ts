"use node";

import { v } from "convex/values";
import { action } from "#convex/_generated/server";
import { tupleErr, tupleOk } from "#/lib/result";
import { submitFeedbackMessage } from "#convex/feedback/services/submitFeedback";

export const submit = action({
	args: { message: v.string() },
	handler: (ctx, args) => submitFeedbackMessage(ctx, args.message).match(tupleOk, tupleErr)
});
