import type { Id } from "#convex/_generated/dataModel";
import {
	renderClientAssetsEmailHtml,
	renderEditorAssignmentEmailHtml,
	renderSessionDeliverablesEmailHtml,
	type SendClientAssetsEmailArgs,
	type SendEditorAssignmentEmailArgs,
	type SendSessionDeliverablesEmailArgs
} from "#convex/lib/email/emailRenders";
import { formatSessionDateShort } from "#convex/lib/sessions/sessionCalendarTime";
import { formatTimestampDateLong, sendEmail } from "#convex/lib/email/emailSend";

function sendClientAssetsEmailWithHtml(
	args: SendClientAssetsEmailArgs & { bookingId: Id<"bookings">; email: string }
) {
	return (html: string) =>
		sendEmail({
			to: [args.email],
			subject: "Anything you'd like us to use in your video edit?",
			html,
			idempotencyKey: `client-assets:${args.bookingId}:${args.assetsUrl}`
		});
}

export function sendClientAssetsEmail(
	args: SendClientAssetsEmailArgs & { bookingId: Id<"bookings">; email: string }
) {
	return renderClientAssetsEmailHtml(args).andThen(sendClientAssetsEmailWithHtml(args));
}

function sendEditorAssignmentEmailWithHtml(
	args: SendEditorAssignmentEmailArgs & { editorEmail: string },
	sessionDate: string
) {
	return (html: string) =>
		sendEmail({
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

	return renderEditorAssignmentEmailHtml(args).andThen(
		sendEditorAssignmentEmailWithHtml(args, sessionDate)
	);
}

function sendSessionDeliverablesEmailWithHtml(
	args: SendSessionDeliverablesEmailArgs & { email: string }
) {
	return (html: string) =>
		sendEmail({
			to: [args.email],
			subject: `Your VV Studios Deliverables Folder - ${formatSessionDateShort(args.date)}`,
			html
		});
}

export function sendSessionDeliverablesEmail(
	args: SendSessionDeliverablesEmailArgs & { email: string }
) {
	return renderSessionDeliverablesEmailHtml(args).andThen(
		sendSessionDeliverablesEmailWithHtml(args)
	);
}
