"use node";

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

	return renderDeliverablesReviewReadyHostEmailHtml(args, hostEmails).andThen((email) =>
		sendEmailIfPresent(buildDeliverablesReviewReadyEmailRequest(args, email)).map(() => null)
	);
}
