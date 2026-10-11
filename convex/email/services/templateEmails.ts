import type { Id } from "#convex/_generated/dataModel";
import {
	renderClientAssetsEmailHtml,
	renderEditorAssignmentEmailHtml,
	renderSessionDeliverablesEmailHtml,
	type SendClientAssetsEmailArgs,
	type SendEditorAssignmentEmailArgs,
	type SendSessionDeliverablesEmailArgs
} from "#convex/shared/lib/email/emailRenders";

import { formatTimestampDateLong } from "#convex/shared/lib/email/emailSend";
import {
	sendClientAssetsEmailWithHtml,
	sendEditorAssignmentEmailWithHtml,
	sendSessionDeliverablesEmailWithHtml
} from "#convex/email/lib/templateEmailsSteps";

export function sendClientAssetsEmail(
	args: SendClientAssetsEmailArgs & { bookingId: Id<"bookings">; email: string }
) {
	return renderClientAssetsEmailHtml(args).andThen((html: string) =>
		sendClientAssetsEmailWithHtml(args, html)
	);
}

export function sendEditorAssignmentEmail(
	args: SendEditorAssignmentEmailArgs & { editorEmail: string }
) {
	const sessionDate = formatTimestampDateLong(args.sessionStartAt);

	return renderEditorAssignmentEmailHtml(args).andThen((html: string) =>
		sendEditorAssignmentEmailWithHtml(args, sessionDate, html)
	);
}

export function sendSessionDeliverablesEmail(
	args: SendSessionDeliverablesEmailArgs & { email: string }
) {
	return renderSessionDeliverablesEmailHtml(args).andThen((html: string) =>
		sendSessionDeliverablesEmailWithHtml(args, html)
	);
}
