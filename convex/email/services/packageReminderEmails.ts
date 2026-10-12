import { ok, safeTry } from "neverthrow";
import {
	renderPackageExpiryReminderEmailHtml,
	type SendPackageExpiryReminderEmailArgs
} from "#convex/shared/lib/email/emailRenders";

import { sendPackageExpiryReminderEmailWithHtml } from "#convex/email/lib/packageReminderEmailsSteps";

export function sendPackageExpiryReminderEmail(args: SendPackageExpiryReminderEmailArgs) {
	return safeTry(async function* () {
		const html = yield* renderPackageExpiryReminderEmailHtml(args);
		const result = yield* sendPackageExpiryReminderEmailWithHtml(args, html);

		return ok(result);
	});
}
