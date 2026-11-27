"use node";

import { ok, safeTry, type ResultAsync } from "neverthrow";
import type { Id } from "#convex/_generated/dataModel";
import type { ActionCtx } from "#convex/_generated/server";
import {
	fetchRevisionRequestedEmailData,
	getRevisionEmailRecipients,
	renderRevisionRequestedEmailHtml,
	runRecordRevisionNotificationStatus,
	sendRevisionRequestedEmailWithHtml,
	type RevisionRequestedEmailData
} from "#convex/revisions/lib/revisionEmail";

function deliverRevisionRequestedEmail(emailData: RevisionRequestedEmailData) {
	return safeTry(async function* () {
		const { recipients, noActiveEditorAssigned } = yield* getRevisionEmailRecipients(
			emailData.roundId,
			emailData.activeEditorEmail
		);

		const html = yield* renderRevisionRequestedEmailHtml(emailData, noActiveEditorAssigned);
		yield* sendRevisionRequestedEmailWithHtml(emailData, recipients, html);

		return ok(null);
	});
}

export function sendRevisionRequestedEmailAndRecordStatus(
	ctx: ActionCtx,
	revisionRoundId: Id<"revisionRounds">
): ResultAsync<null, { reason: "REVISION_ROUND_NOT_FOUND" }> {
	return safeTry(async function* () {
		const emailData = yield* fetchRevisionRequestedEmailData(ctx, revisionRoundId);

		const status = yield* deliverRevisionRequestedEmail(emailData)
			.map(() => "sent" as const)
			.orElse(() => ok("failed" as const));

		yield* runRecordRevisionNotificationStatus(ctx, revisionRoundId, status);

		return ok(null);
	});
}
