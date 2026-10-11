import { sendEmail } from "#convex/shared/lib/email/emailSend";
import type { Id } from "#convex/_generated/dataModel";
import {
	type SendClientAssetsEmailArgs,
	type SendEditorAssignmentEmailArgs,
	type SendSessionDeliverablesEmailArgs
} from "#convex/shared/lib/email/emailRenders";
import { formatSessionDateShort } from "#convex/sessions/lib/calendarTime";

export function sendClientAssetsEmailWithHtml(
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

export function sendEditorAssignmentEmailWithHtml(
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

export function sendSessionDeliverablesEmailWithHtml(
	args: SendSessionDeliverablesEmailArgs & { email: string },

	html: string
) {
	return sendEmail({
		to: [args.email],
		subject: `Your VV Studios Deliverables Folder - ${formatSessionDateShort(args.date)}`,
		html
	});
}
