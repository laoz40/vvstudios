"use node";

import { ok, safeTry } from "neverthrow";
import { buildSessionNotesEmailRequest } from "#convex/sessions/lib/notesEmail";
import { sendEmailIfPresent } from "#convex/shared/lib/email/emailSend";
import { renderSessionNotesEmailHtml } from "#convex/shared/lib/email/emailRenders";

export function sendSessionNotesEmail(args: Parameters<typeof buildSessionNotesEmailRequest>[0]) {
	return safeTry(async function* () {
		const html = yield* renderSessionNotesEmailHtml(args);

		yield* sendEmailIfPresent(buildSessionNotesEmailRequest(args, html));

		return ok(null);
	});
}
