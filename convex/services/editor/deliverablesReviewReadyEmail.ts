"use node";

import { okAsync } from "neverthrow";
import {
	deliverablesReviewReadyHostEmailSubject,
	renderDeliverablesReviewReadyHostEmailHtml
} from "#convex/lib/email/emailRenders";
import { getHostEmails, sendEmail } from "#convex/lib/email/emailSend";

export function sendDeliverablesReviewReadyEmail(args: {
	clientName: string;
	editorName: string;
	sessionDate: string;
	idempotencyKey: string;
}) {
	const hostEmails = getHostEmails();

	if (hostEmails.length === 0) {
		return okAsync(null);
	}

	return renderDeliverablesReviewReadyHostEmailHtml({
		clientName: args.clientName,
		editorName: args.editorName,
		sessionDate: args.sessionDate
	}).andThen((html) =>
		sendEmail({
			to: hostEmails,
			subject: deliverablesReviewReadyHostEmailSubject(args),
			html,
			idempotencyKey: args.idempotencyKey
		}).map(() => null)
	);
}
