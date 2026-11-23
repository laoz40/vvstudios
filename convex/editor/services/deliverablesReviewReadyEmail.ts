"use node";

import { ok, safeTry } from "neverthrow";

import type { Id } from "#convex/_generated/dataModel";
import type { ActionCtx } from "#convex/_generated/server";
import { loadDeliverablesFolderWithFiles } from "#convex/editor/services/deliverablesEmail";
import { renderDeliverablesReviewReadyHostEmailHtml } from "#convex/shared/lib/email/emailRenders";
import { getHostEmails, sendEmailIfPresent } from "#convex/shared/lib/email/emailSend";
import {
	buildDeliverablesReviewReadyEmailRequest,
	requireReviewRecipients
} from "#convex/editor/lib/deliverablesReviewEmail";

export function emailAdminsForEditReview(
	ctx: ActionCtx,
	bookingId: Id<"bookings">,
	args: Omit<Parameters<typeof emailAdminsForDeliverablesReview>[0], "deliverablesFolderUrl">
) {
	return safeTry(async function* () {
		const folder = yield* loadDeliverablesFolderWithFiles(ctx, bookingId);

		return ok(
			yield* emailAdminsForDeliverablesReview({ ...args, deliverablesFolderUrl: folder.url })
		);
	});
}

export function emailAdminsForDeliverablesReview(args: {
	clientName: string;
	deliverablesFolderUrl?: string;
	editLabel?: string;
	editorName: string;
	editorNotes?: string;
	sessionDate: string;
	idempotencyKey: string;
}) {
	const hostEmails = getHostEmails();

	return safeTry(async function* () {
		const recipients = yield* requireReviewRecipients(hostEmails, args.editLabel);
		const email = yield* renderDeliverablesReviewReadyHostEmailHtml(args, recipients);
		yield* sendEmailIfPresent(buildDeliverablesReviewReadyEmailRequest(args, email));

		return ok(null);
	});
}
