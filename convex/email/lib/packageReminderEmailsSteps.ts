import {
	packageExpiryReminderEmailSubject,
	type SendPackageExpiryReminderEmailArgs
} from "#convex/shared/lib/email/emailRenders";
import { sendEmail } from "#convex/shared/lib/email/emailSend";

export function sendPackageExpiryReminderEmailWithHtml(
	args: SendPackageExpiryReminderEmailArgs,
	html: string
) {
	return sendEmail({
		to: [args.email],
		subject: packageExpiryReminderEmailSubject(args),
		html,
		logContext: { operation: "email.sendPackageExpiryReminder", packageId: args.packageId }
	});
}
