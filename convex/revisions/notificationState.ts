import { v } from "convex/values";
import { ok, safeTry } from "neverthrow";
import { tupleErr, tupleOk } from "#/lib/result";
import { internalMutation, internalQuery } from "#convex/_generated/server";
import {
	loadRevisionRequestedEmailData,
	saveRevisionNotificationStatus
} from "#convex/revisions/services/submitRevision";

export const getRevisionRequestedEmailData = internalQuery({
	args: { revisionRoundId: v.id("revisionRounds") },
	handler: (ctx, args) =>
		loadRevisionRequestedEmailData(ctx, args.revisionRoundId).match(tupleOk, tupleErr)
});

export const recordRevisionNotificationStatus = internalMutation({
	args: {
		revisionRoundId: v.id("revisionRounds"),
		status: v.union(v.literal("sent"), v.literal("failed"))
	},
	handler: (ctx, args) =>
		safeTry(async function* () {
			yield* saveRevisionNotificationStatus(ctx, args.revisionRoundId, args.status);

			return ok(null);
		}).match(tupleOk, tupleErr)
});
