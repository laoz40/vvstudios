"use node";

import { v } from "convex/values";
import { tupleErr, tupleOk } from "#/lib/result";
import { internalAction } from "#convex/_generated/server";
import { sendDeliverablesReviewReadyEmail as sendDeliverablesReviewReadyEmailStep } from "#convex/editor/services/deliverablesReviewReadyEmail";

export const sendDeliverablesReviewReadyEmail = internalAction({
	args: {
		bookingId: v.id("bookings"),
		clientName: v.string(),
		editorName: v.string(),
		idempotencyKey: v.string(),
		sessionDate: v.string()
	},
	handler: (_ctx, args) =>
		sendDeliverablesReviewReadyEmailStep({
			clientName: args.clientName,
			editorName: args.editorName,
			sessionDate: args.sessionDate,
			idempotencyKey: args.idempotencyKey
		}).match(tupleOk, tupleErr)
});
