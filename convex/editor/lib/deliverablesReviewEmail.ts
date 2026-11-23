import type { SendDeliverablesReviewReadyHostEmailArgs } from "#convex/shared/lib/email/emailRenders";
import { deliverablesReviewReadyHostEmailSubject } from "#convex/shared/lib/email/emailRenders";
import type { sendEmail } from "#convex/shared/lib/email/emailSend";

type RenderedDeliverablesReviewEmail = { html: string; recipients: string[] } | null;

export function requireReviewRecipients(recipients: string[], editLabel: string | undefined) {
	return editLabel !== undefined && recipients.length === 0
		? err({ reason: "EMAIL_REQUEST_FAILED" as const })
		: ok(recipients);
}

export function buildDeliverablesReviewReadyEmailRequest(
	args: SendDeliverablesReviewReadyHostEmailArgs & { idempotencyKey: string },
	email: RenderedDeliverablesReviewEmail
): Parameters<typeof sendEmail>[0] | null {
	return email === null
		? null
		: {
				to: email.recipients,
				subject: deliverablesReviewReadyHostEmailSubject(args),
				html: email.html,
				logContext: { operation: "email.sendDeliverablesReviewReady" },
				idempotencyKey: args.idempotencyKey
			};
}

import { err, ok } from "neverthrow";
