"use node";

import { okAsync, type ResultAsync } from "neverthrow";

import { sendEmail } from "#convex/shared/lib/email/emailSend";

import {
	renderPackageHostDetailsEmailHtml,
	renderSessionHostDetailsEmailHtml,
	packageHostDetailsEmailSubject,
	sessionHostDetailsEmailSubject,
	type SendPackageHostDetailsEmailArgs,
	type SendSessionHostDetailsEmailArgs
} from "#convex/shared/lib/email/emailRenders";

export function sendSessionHostDetailsEmailWithHtml(
	hostEmails: string[],
	args: SendSessionHostDetailsEmailArgs | null,

	html: string | null
): ReturnType<typeof sendEmail> {
	if (args === null || html === null) return okAsync(null);

	return sendEmail({ to: hostEmails, subject: sessionHostDetailsEmailSubject(args), html }).map(
		() => null
	);
}

export function sendPackageHostDetailsEmailWithHtml(
	hostEmails: string[],
	args: SendPackageHostDetailsEmailArgs | null,

	html: string | null
): ReturnType<typeof sendEmail> {
	if (args === null || html === null) return okAsync(null);

	return sendEmail({ to: hostEmails, subject: packageHostDetailsEmailSubject(args), html }).map(
		() => null
	);
}

export function renderSessionHostEmailWhenNeeded(
	args: SendSessionHostDetailsEmailArgs | null,
	hosts: string[]
): ResultAsync<string | null, { reason: "EMAIL_RENDER_FAILED" }> {
	if (args === null || hosts.length === 0) return okAsync(null);

	return renderSessionHostDetailsEmailHtml(args);
}

export function renderPackageHostEmailWhenNeeded(
	args: SendPackageHostDetailsEmailArgs | null,
	hosts: string[]
): ResultAsync<string | null, { reason: "EMAIL_RENDER_FAILED" }> {
	if (args === null || hosts.length === 0) return okAsync(null);

	return renderPackageHostDetailsEmailHtml(args);
}
