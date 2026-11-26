import { v } from "convex/values";
import { ok, safeTry } from "neverthrow";
import { tupleErr, tupleOk } from "#/lib/result";
import { query } from "#convex/_generated/server";
import {
	loadEligibleFeedbackSessionByToken,
	loadFeedbackSessionView
} from "#convex/revisions/services/feedbackSession";

export const getFeedbackSessionByToken = query({
	args: { token: v.string() },
	handler: (ctx, args) =>
		safeTry(async function* () {
			const session = yield* loadEligibleFeedbackSessionByToken(ctx, args.token);
			const view = yield* loadFeedbackSessionView(ctx, session, Date.now());

			return ok(view);
		}).match(tupleOk, tupleErr)
});
