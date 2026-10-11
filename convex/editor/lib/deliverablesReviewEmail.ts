import type { SendDeliverablesReviewReadyHostEmailArgs } from "#convex/shared/lib/email/emailRenders";
import { deliverablesReviewReadyHostEmailSubject } from "#convex/shared/lib/email/emailRenders";
import type { sendEmail } from "#convex/shared/lib/email/emailSend";

type RenderedDeliverablesReviewEmail = { html: string; recipients: string[] } | null;

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
				idempotencyKey: args.idempotencyKey
			};
}
