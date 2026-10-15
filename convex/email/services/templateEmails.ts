import type { Id } from "#convex/_generated/dataModel";
import { ok, safeTry } from "neverthrow";
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
	return safeTry(async function* () {
		const html = yield* renderClientAssetsEmailHtml(args, {
			operation: "email.renderClientAssets",
			bookingId: args.bookingId
		});

		const result = yield* sendClientAssetsEmailWithHtml(args, html);

		return ok(result);
	});
}

export function sendEditorAssignmentEmail(
	args: SendEditorAssignmentEmailArgs & { bookingId: Id<"bookings">; editorEmail: string }
) {
	const sessionDate = formatTimestampDateLong(args.sessionStartAt);

	return safeTry(async function* () {
		const html = yield* renderEditorAssignmentEmailHtml(args, {
			operation: "email.renderEditorAssignment",
			bookingId: args.bookingId
		});

		const result = yield* sendEditorAssignmentEmailWithHtml(args, sessionDate, html);

		return ok(result);
	});
}

export function sendSessionDeliverablesEmail(
	args: SendSessionDeliverablesEmailArgs & { bookingId: Id<"bookings">; email: string }
) {
	return safeTry(async function* () {
		const html = yield* renderSessionDeliverablesEmailHtml(args, {
			operation: "email.renderSessionDeliverables",
			bookingId: args.bookingId
		});

		const result = yield* sendSessionDeliverablesEmailWithHtml(args, html);

		return ok(result);
	});
}
