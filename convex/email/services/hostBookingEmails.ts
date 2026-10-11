"use node";

import type {
	SendPackageHostDetailsEmailArgs,
	SendSessionHostDetailsEmailArgs
} from "#convex/shared/lib/email/emailRenders";
import { getHostEmails } from "#convex/shared/lib/email/emailSend";
import {
	renderSessionHostEmailWhenNeeded,
	renderPackageHostEmailWhenNeeded,
	sendSessionHostDetailsEmailWithHtml,
	sendPackageHostDetailsEmailWithHtml
} from "#convex/email/lib/hostBookingEmailsSteps";

export function sendSessionHostDetailsEmail(args: SendSessionHostDetailsEmailArgs | null) {
	const hostEmails = getHostEmails();

	return renderSessionHostEmailWhenNeeded(args, hostEmails).andThen((html) =>
		sendSessionHostDetailsEmailWithHtml(hostEmails, args, html)
	);
}

export function sendPackageHostDetailsEmail(args: SendPackageHostDetailsEmailArgs | null) {
	const hostEmails = getHostEmails();

	return renderPackageHostEmailWhenNeeded(args, hostEmails).andThen((html) =>
		sendPackageHostDetailsEmailWithHtml(hostEmails, args, html)
	);
}
