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

	return sendEmail({
		to: hostEmails,
		subject: sessionHostDetailsEmailSubject(args),
		html,
		logContext: { operation: "email.sendSessionHostDetails", bookingId: args.bookingId }
	}).map(() => null);
}

export function sendPackageHostDetailsEmailWithHtml(
	hostEmails: string[],
	args: SendPackageHostDetailsEmailArgs | null,

	html: string | null
): ReturnType<typeof sendEmail> {
	if (args === null || html === null) return okAsync(null);

	return sendEmail({
		to: hostEmails,
		subject: packageHostDetailsEmailSubject(args),
		html,
		logContext: { operation: "email.sendPackageHostDetails", packageId: args.packageId }
	}).map(() => null);
}

export function renderSessionHostEmailWhenNeeded(
	args: SendSessionHostDetailsEmailArgs | null,
	hosts: string[]
): ResultAsync<string | null, { reason: "EMAIL_RENDER_FAILED" }> {
	if (args === null || hosts.length === 0) return okAsync(null);

	return renderSessionHostDetailsEmailHtml(args, {
		operation: "email.renderSessionHostDetails",
		bookingId: args.bookingId
	});
}

export function renderPackageHostEmailWhenNeeded(
	args: SendPackageHostDetailsEmailArgs | null,
	hosts: string[]
): ResultAsync<string | null, { reason: "EMAIL_RENDER_FAILED" }> {
	if (args === null || hosts.length === 0) return okAsync(null);

	return renderPackageHostDetailsEmailHtml(args, {
		operation: "email.renderPackageHostDetails",
		packageId: args.packageId
	});
}
