import {
	renderPackageExpiryReminderEmailHtml,
	packageExpiryReminderEmailSubject,
	type SendPackageExpiryReminderEmailArgs
} from "#convex/lib/email/emailRenders";
import { sendEmail } from "#convex/lib/email/emailSend";

export function sendPackageExpiryReminderEmail(args: SendPackageExpiryReminderEmailArgs) {
	return renderPackageExpiryReminderEmailHtml(args).andThen((html) =>
		sendEmail({ to: [args.email], subject: packageExpiryReminderEmailSubject(args), html })
	);
}
