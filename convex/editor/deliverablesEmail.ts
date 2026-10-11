"use node";

import { ok, safeTry } from "neverthrow";
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
		safeTry(async function* () {
			const booking = yield* loadSessionForDeliverablesFromAction(ctx, args.bookingId);
			const session = yield* skipWhenDeliverablesEditAlreadyCompleted(booking);

			if (session === null) {
				return ok(null);
			}

			const folder = yield* loadDeliverablesFolderGuestReadLink(ctx, session._id);

			const result = yield* sendDeliverablesEmailForSession(
				ctx,
				session,
				folder.url,
				args.editorNotes
			);

			return ok(result);
		}).match(tupleOk, tupleErr)
});
