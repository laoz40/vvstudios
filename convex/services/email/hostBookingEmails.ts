import { okAsync } from "neverthrow";
import {
	renderPackageHostDetailsEmailHtml,
	renderSessionHostDetailsEmailHtml,
	packageHostDetailsEmailSubject,
	sessionHostDetailsEmailSubject,
	type SendPackageHostDetailsEmailArgs,
	type SendSessionHostDetailsEmailArgs
} from "#convex/lib/email/emailRenders";
import { getHostEmails, sendEmail } from "#convex/lib/email/emailSend";

export function sendSessionHostDetailsEmail(args: SendSessionHostDetailsEmailArgs) {
	const hostEmails = getHostEmails();

	if (hostEmails.length === 0) {
		return okAsync(null);
	}

	return renderSessionHostDetailsEmailHtml(args).andThen((html) =>
		sendEmail({ to: hostEmails, subject: sessionHostDetailsEmailSubject(args), html }).map(
			() => null
		)
	);
}

export function sendPackageHostDetailsEmail(args: SendPackageHostDetailsEmailArgs) {
	const hostEmails = getHostEmails();

	if (hostEmails.length === 0) {
		return okAsync(null);
	}

	return renderPackageHostDetailsEmailHtml(args).andThen((html) =>
		sendEmail({ to: hostEmails, subject: packageHostDetailsEmailSubject(args), html }).map(
			() => null
		)
	);
}
