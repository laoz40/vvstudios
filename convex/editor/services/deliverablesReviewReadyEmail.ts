"use node";

import { okAsync } from "neverthrow";
import {
	deliverablesReviewReadyHostEmailSubject,
	renderDeliverablesReviewReadyHostEmailHtml
} from "#convex/shared/lib/email/emailRenders";
import { getHostEmails, sendEmail } from "#convex/shared/lib/email/emailSend";

function returnNull(): null {
	return null;
}

function sendDeliverablesReviewReadyEmailWithHtml(
	hostEmails: string[],
	args: { clientName: string; editorName: string; sessionDate: string; idempotencyKey: string },

	html: string
) {
	return sendEmail({
		to: hostEmails,
		subject: deliverablesReviewReadyHostEmailSubject(args),
		html,
		idempotencyKey: args.idempotencyKey
	}).map(returnNull);
}

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
	}).andThen((html: string) => sendDeliverablesReviewReadyEmailWithHtml(hostEmails, args, html));
}
