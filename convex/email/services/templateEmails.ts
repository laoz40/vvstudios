import type { Id } from "#convex/_generated/dataModel";
import {
	renderClientAssetsEmailHtml,
	renderEditorAssignmentEmailHtml,
	renderSessionDeliverablesEmailHtml,
	type SendClientAssetsEmailArgs,
	type SendEditorAssignmentEmailArgs,
	type SendSessionDeliverablesEmailArgs
} from "#convex/shared/lib/email/emailRenders";
import { formatSessionDateShort } from "#convex/sessions/lib/calendarTime";
import { formatTimestampDateLong, sendEmail } from "#convex/shared/lib/email/emailSend";

function sendClientAssetsEmailWithHtml(
	args: SendClientAssetsEmailArgs & { bookingId: Id<"bookings">; email: string },

	html: string
) {
	return sendEmail({
		to: [args.email],
		subject: "Anything you'd like us to use in your video edit?",
		html,
		idempotencyKey: `client-assets:${args.bookingId}:${args.assetsUrl}`
	});
}

export function sendClientAssetsEmail(
	args: SendClientAssetsEmailArgs & { bookingId: Id<"bookings">; email: string }
) {
	return renderClientAssetsEmailHtml(args).andThen((html: string) =>
		sendClientAssetsEmailWithHtml(args, html)
	);
}

function sendEditorAssignmentEmailWithHtml(
	args: SendEditorAssignmentEmailArgs & { editorEmail: string },
	sessionDate: string,

	html: string
) {
	return sendEmail({
		to: [args.editorEmail],
		subject: `New editing job assigned: ${args.sessionName}, ${sessionDate}`,
		html,
		idempotencyKey: `editor-assignment:${args.editorEmail}:${args.sessionStartAt}`
	});
}

export function sendEditorAssignmentEmail(
	args: SendEditorAssignmentEmailArgs & { editorEmail: string }
) {
	const sessionDate = formatTimestampDateLong(args.sessionStartAt);

	return renderEditorAssignmentEmailHtml(args).andThen((html: string) =>
		sendEditorAssignmentEmailWithHtml(args, sessionDate, html)
	);
}

function sendSessionDeliverablesEmailWithHtml(
	args: SendSessionDeliverablesEmailArgs & { email: string },

	html: string
) {
	return sendEmail({
		to: [args.email],
		subject: `Your VV Studios Deliverables Folder - ${formatSessionDateShort(args.date)}`,
		html
	});
}

export function sendSessionDeliverablesEmail(
	args: SendSessionDeliverablesEmailArgs & { email: string }
) {
	return renderSessionDeliverablesEmailHtml(args).andThen((html: string) =>
		sendSessionDeliverablesEmailWithHtml(args, html)
	);
}
