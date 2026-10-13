"use node";

import { v } from "convex/values";
import { internalAction } from "#convex/_generated/server";
import { tupleErr, tupleOk } from "#/lib/result";
import { sendSessionNotesEmail as sendNotesEmail } from "#convex/sessions/services/notesEmail";

export const sendSessionNotesEmail = internalAction({
	args: {
		notification: v.union(
			v.object({
				kind: v.literal("admin"),
				clientName: v.string(),
				sessionDate: v.string(),
				notes: v.string(),
				editorEmail: v.string(),
				idempotencyKey: v.string()
			}),
			v.object({
				kind: v.literal("editor"),
				clientName: v.string(),
				sessionDate: v.string(),
				notes: v.string(),
				idempotencyKey: v.string()
			})
		)
	},
	handler: (_ctx, args) => sendNotesEmail(args.notification).match(tupleOk, tupleErr)
});
