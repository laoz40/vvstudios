import {
	renderPackageExpiryReminderEmailHtml,
	packageExpiryReminderEmailSubject,
	type SendPackageExpiryReminderEmailArgs
} from "#convex/lib/email/emailRenders";
import { sendEmail } from "#convex/lib/email/emailSend";

function sendPackageExpiryReminderEmailWithHtml(
	args: SendPackageExpiryReminderEmailArgs,
	html: string
) {
	return sendEmail({ to: [args.email], subject: packageExpiryReminderEmailSubject(args), html });
}

export function sendPackageExpiryReminderEmail(args: SendPackageExpiryReminderEmailArgs) {
	return renderPackageExpiryReminderEmailHtml(args).andThen((html: string) =>
		sendPackageExpiryReminderEmailWithHtml(args, html)
	);
}
