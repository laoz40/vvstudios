import { v } from "convex/values";
import { ok, safeTry } from "neverthrow";
import { tupleErr, tupleOk } from "#/lib/result";
import { mutation, query } from "#convex/_generated/server";
import { updateSessionStatusFromEdits } from "#convex/editor/services/editDelivery";
import {
	loadEligibleFeedbackSessionByToken,
	loadFeedbackSessionView
} from "#convex/revisions/services/feedbackSession";
import {
	recordFreeRevisionSubmission,
	validateFreeRevisionSubmission
} from "#convex/revisions/services/submitRevision";

export const getFeedbackSessionByToken = query({
	args: { token: v.string() },
	handler: (ctx, args) =>
		safeTry(async function* () {
			const session = yield* loadEligibleFeedbackSessionByToken(ctx, args.token);
			const view = yield* loadFeedbackSessionView(ctx, session, Date.now());

			return ok(view);
		}).match(tupleOk, tupleErr)
});

export const submitFreeRevisionRound = mutation({
	args: {
		token: v.string(),
		editId: v.id("edits"),
		feedbackRows: v.array(
			v.object({ timestamp: v.string(), note: v.string(), clipNumber: v.optional(v.string()) })
		)
	},
	handler: (ctx, args) =>
		safeTry(async function* () {
			const now = Date.now();
			const session = yield* loadEligibleFeedbackSessionByToken(ctx, args.token);
			const submission = yield* validateFreeRevisionSubmission(ctx, session, args, now);
			const recorded = yield* recordFreeRevisionSubmission(ctx, session, submission, now);
			yield* updateSessionStatusFromEdits(ctx, session);

			return ok(recorded);
		}).match(tupleOk, tupleErr)
});
