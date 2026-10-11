import {
	renderPackageExpiryReminderEmailHtml,
	type SendPackageExpiryReminderEmailArgs
} from "#convex/shared/lib/email/emailRenders";

import { sendPackageExpiryReminderEmailWithHtml } from "#convex/email/lib/packageReminderEmailsSteps";

export function sendPackageExpiryReminderEmail(args: SendPackageExpiryReminderEmailArgs) {
	return renderPackageExpiryReminderEmailHtml(args).andThen((html: string) =>
		sendPackageExpiryReminderEmailWithHtml(args, html)
	);
}
