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
import { ok, safeTry } from "neverthrow";

export function sendSessionHostDetailsEmail(args: SendSessionHostDetailsEmailArgs | null) {
	const hostEmails = getHostEmails();

	return safeTry(async function* () {
		const html = yield* renderSessionHostEmailWhenNeeded(args, hostEmails);
		const result = yield* sendSessionHostDetailsEmailWithHtml(hostEmails, args, html);

		return ok(result);
	});
}

export function sendPackageHostDetailsEmail(args: SendPackageHostDetailsEmailArgs | null) {
	const hostEmails = getHostEmails();

	return safeTry(async function* () {
		const html = yield* renderPackageHostEmailWhenNeeded(args, hostEmails);
		const result = yield* sendPackageHostDetailsEmailWithHtml(hostEmails, args, html);

		return ok(result);
	});
}
