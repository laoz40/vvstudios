"use node";

import { sendDeliverablesReviewReadyHostEmail } from "#convex/lib/email/email";

export function sendDeliverablesReviewReadyEmail(args: {
	clientName: string;
	editorName: string;
	sessionDate: string;
	idempotencyKey: string;
}) {
	return sendDeliverablesReviewReadyHostEmail(args);
}
