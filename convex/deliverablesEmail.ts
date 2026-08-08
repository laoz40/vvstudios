"use node";

import { v } from "convex/values";
import { tupleErr, tupleOk } from "#/lib/result";
import { action } from "./_generated/server";
import { sendSessionDeliverablesEmailService } from "./services/deliverablesEmail";

export const sendSessionDeliverablesEmail = action({
	args: {
		bookingId: v.id("bookings"),
		driveLink: v.string(),
		editorNotes: v.optional(v.string()),
		emailVariant: v.union(v.literal("first-time"), v.literal("recurring"))
	},
	handler: (ctx, args) => sendSessionDeliverablesEmailService(ctx, args).match(tupleOk, tupleErr)
});
