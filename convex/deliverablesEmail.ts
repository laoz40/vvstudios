"use node";

import { v } from "convex/values";
import { err as tupleErr, ok as tupleOk } from "#/lib/result";
import { action, type ActionCtx } from "./_generated/server";
import {
	sendSessionDeliverablesEmailService,
	type SendSessionDeliverablesEmailArgs
} from "./services/deliverablesEmail";

export const sendSessionDeliverablesEmail = action({
	args: {
		bookingId: v.id("bookings"),
		driveLink: v.string(),
		editorNotes: v.optional(v.string()),
		emailVariant: v.union(v.literal("first-time"), v.literal("recurring"))
	},
	handler: (ctx, args) => sendSessionDeliverablesEmailHandler(ctx, args)
});

function sendSessionDeliverablesEmailHandler(
	ctx: ActionCtx,
	args: SendSessionDeliverablesEmailArgs
) {
	return sendSessionDeliverablesEmailService(ctx, args).match(tupleOk, tupleErr);
}

export type SendSessionDeliverablesEmailResult = Awaited<
	ReturnType<typeof sendSessionDeliverablesEmailHandler>
>;
