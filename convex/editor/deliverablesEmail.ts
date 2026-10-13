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
			const session = yield* loadSessionForDeliverablesFromAction(ctx, args.bookingId);
			const eligibleSession = yield* skipWhenDeliverablesEditAlreadyCompleted(session);

			if (eligibleSession === null) {
				return ok(null);
			}

			const folder = yield* loadDeliverablesFolderGuestReadLink(ctx, eligibleSession._id);

			const result = yield* sendDeliverablesEmailForSession(
				ctx,
				eligibleSession,
				folder.url,
				args.editorNotes
			);

			return ok(result);
		}).match(tupleOk, tupleErr)
});
