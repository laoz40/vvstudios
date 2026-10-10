"use node";

import { okAsync } from "neverthrow";
import { v } from "convex/values";
import { tupleErr, tupleOk, type Result } from "#/lib/result";
import { action } from "#convex/_generated/server";
import {
	skipWhenDeliverablesEditAlreadyCompleted,
	loadDeliverablesFolderGuestReadLink,
	sendDeliverablesEmailForSession,
	type SendDeliverablesError
} from "#convex/editor/services/deliverablesEmail";
import { loadSessionForDeliverablesFromAction } from "#convex/editor/services/loadSessionForDeliverables";

export const sendSessionDeliverablesEmail = action({
	args: { bookingId: v.id("bookings"), editorNotes: v.optional(v.string()) },
	handler: (ctx, args): Promise<Result<null, SendDeliverablesError>> =>
		loadSessionForDeliverablesFromAction(ctx, args.bookingId)
			.andThen(skipWhenDeliverablesEditAlreadyCompleted)
			.andThen((session) => {
				if (session === null) {
					return okAsync(null);
				}

				return loadDeliverablesFolderGuestReadLink(ctx, session._id).andThen((folder) =>
					sendDeliverablesEmailForSession(ctx, session, folder.url, args.editorNotes)
				);
			})
			.match(tupleOk, tupleErr)
});
