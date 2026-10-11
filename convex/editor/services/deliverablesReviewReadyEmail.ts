"use node";

import { ok, safeTry } from "neverthrow";

import { renderDeliverablesReviewReadyHostEmailHtml } from "#convex/shared/lib/email/emailRenders";
import { getHostEmails, sendEmailIfPresent } from "#convex/shared/lib/email/emailSend";
import { buildDeliverablesReviewReadyEmailRequest } from "#convex/editor/lib/deliverablesReviewEmail";

export function sendDeliverablesReviewReadyEmail(args: {
	clientName: string;
	editorName: string;
	sessionDate: string;
	idempotencyKey: string;
}) {
	const hostEmails = getHostEmails();

	return safeTry(async function* () {
		const email = yield* renderDeliverablesReviewReadyHostEmailHtml(args, hostEmails);

		yield* sendEmailIfPresent(buildDeliverablesReviewReadyEmailRequest(args, email));

		return ok(null);
	});
}
