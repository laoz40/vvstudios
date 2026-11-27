"use node";

import { v } from "convex/values";
import { tupleErr, tupleOk, type Result } from "#/lib/result";
import { internalAction } from "#convex/_generated/server";
import { sendRevisionRequestedEmailAndRecordStatus } from "#convex/revisions/services/revisionEmail";

export const sendRevisionRequestedEmail = internalAction({
	args: { revisionRoundId: v.id("revisionRounds") },
	handler: (ctx, args): Promise<Result<null, { reason: "REVISION_ROUND_NOT_FOUND" }>> =>
		sendRevisionRequestedEmailAndRecordStatus(ctx, args.revisionRoundId).match(tupleOk, tupleErr)
});
