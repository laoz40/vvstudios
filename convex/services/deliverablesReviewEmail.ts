"use node";

import type { ResultAsync } from "neverthrow";
import type { Id } from "#convex/_generated/dataModel";
import type { ActionCtx } from "#convex/_generated/server";
import { sendDeliverablesReviewReadyHostEmail } from "#convex/lib/email";

export type SendDeliverablesReviewReadyEmailArgs = {
	bookingId: Id<"bookings">;
	clientName: string;
	editorName: string;
	idempotencyKey: string;
	sessionDate: string;
};

type SendDeliverablesReviewReadyEmailError =
	| { reason: "EMAIL_RENDER_FAILED" }
	| { reason: "EMAIL_REQUEST_FAILED" }
	| { reason: "EMAIL_RESPONSE_FAILED" };

export function sendDeliverablesReviewReadyEmailService(
	_ctx: ActionCtx,
	args: SendDeliverablesReviewReadyEmailArgs
): ResultAsync<null, SendDeliverablesReviewReadyEmailError> {
	return sendDeliverablesReviewReadyHostEmail({
		clientName: args.clientName,
		editorName: args.editorName,
		sessionDate: args.sessionDate,
		idempotencyKey: args.idempotencyKey
	});
}
