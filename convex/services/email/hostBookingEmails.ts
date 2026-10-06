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

function returnNull(): null {
	return null;
}

function sendSessionHostDetailsEmailWithHtml(
	hostEmails: string[],
	args: SendSessionHostDetailsEmailArgs,

	html: string
) {
	return sendEmail({ to: hostEmails, subject: sessionHostDetailsEmailSubject(args), html }).map(
		returnNull
	);
}

export function sendSessionHostDetailsEmail(args: SendSessionHostDetailsEmailArgs) {
	const hostEmails = getHostEmails();

	if (hostEmails.length === 0) {
		return okAsync(null);
	}

	return renderSessionHostDetailsEmailHtml(args).andThen((html: string) =>
		sendSessionHostDetailsEmailWithHtml(hostEmails, args, html)
	);
}

function sendPackageHostDetailsEmailWithHtml(
	hostEmails: string[],
	args: SendPackageHostDetailsEmailArgs,

	html: string
) {
	return sendEmail({ to: hostEmails, subject: packageHostDetailsEmailSubject(args), html }).map(
		returnNull
	);
}

export function sendPackageHostDetailsEmail(args: SendPackageHostDetailsEmailArgs) {
	const hostEmails = getHostEmails();

	if (hostEmails.length === 0) {
		return okAsync(null);
	}

	return renderPackageHostDetailsEmailHtml(args).andThen((html: string) =>
		sendPackageHostDetailsEmailWithHtml(hostEmails, args, html)
	);
}
