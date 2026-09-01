"use node";

import { v } from "convex/values";
import { tupleErr, tupleOk } from "#/lib/result";
import { action } from "./_generated/server";
import { sendSessionDeliverablesEmailService } from "./services/deliverablesEmail";

export const sendSessionDeliverablesEmail = action({
	args: { bookingId: v.id("bookings"), editorNotes: v.optional(v.string()) },
	handler: (ctx, args) => sendSessionDeliverablesEmailService(ctx, args).match(tupleOk, tupleErr)
});
