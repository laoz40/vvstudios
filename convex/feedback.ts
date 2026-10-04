"use node";

import { v } from "convex/values";
import { tupleErr, tupleOk } from "#/lib/result";
import { action } from "#convex/_generated/server";
import { submitFeedbackService } from "#convex/services/feedback/submitFeedback";

export const submit = action({
	args: { message: v.string() },
	handler: (ctx, args) => submitFeedbackService(ctx, args).match(tupleOk, tupleErr)
});
