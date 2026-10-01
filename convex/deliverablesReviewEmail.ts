"use node";

import { v } from "convex/values";
import { tupleErr, tupleOk } from "#/lib/result";
import { internalAction } from "#convex/_generated/server";
import { sendDeliverablesReviewReadyEmailService } from "#convex/services/deliverablesReviewEmail";

export const sendDeliverablesReviewReadyEmail = internalAction({
	args: {
		bookingId: v.id("bookings"),
		clientName: v.string(),
		editorName: v.string(),
		idempotencyKey: v.string(),
		sessionDate: v.string()
	},
	handler: (ctx, args) =>
		sendDeliverablesReviewReadyEmailService(ctx, args).match(tupleOk, tupleErr)
});
