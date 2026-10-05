"use node";

import { okAsync } from "neverthrow";
import { v } from "convex/values";
import { tupleErr, tupleOk, type Result } from "#/lib/result";
import { action } from "#convex/_generated/server";
import {
	assertDeliverablesEmailPending,
	prepareDeliverablesFolderForSend,
	sendDeliverablesEmailForSession,
	type SendDeliverablesError
} from "#convex/services/editor/deliverablesEmail";
import { loadSessionForDeliverablesFromAction } from "#convex/services/editor/loadSessionForDeliverables";

export const sendSessionDeliverablesEmail = action({
	args: { bookingId: v.id("bookings"), editorNotes: v.optional(v.string()) },
	handler: (ctx, args): Promise<Result<null, SendDeliverablesError>> =>
		loadSessionForDeliverablesFromAction(ctx, args.bookingId)
			.andThen(assertDeliverablesEmailPending)
			.andThen((session) => {
				if (session === null) {
					return okAsync(null);
				}

				return prepareDeliverablesFolderForSend(ctx, session._id).andThen((folder) =>
					sendDeliverablesEmailForSession(ctx, session, folder.url, args.editorNotes)
				);
			})
			.match(tupleOk, tupleErr)
});
