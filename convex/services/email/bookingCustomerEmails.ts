import {
	renderBookingRescheduledCustomerEmailHtml,
	renderSessionReminderEmailHtml,
	bookingRescheduledCustomerEmailSubject,
	sessionReminderEmailSubject,
	type SendBookingRescheduledCustomerEmailArgs
} from "#convex/lib/email/emailRenders";
import { getHostEmails, sendEmail } from "#convex/lib/email/emailSend";

export function sendBookingRescheduledCustomerEmail(args: SendBookingRescheduledCustomerEmailArgs) {
	return renderBookingRescheduledCustomerEmailHtml(args).andThen((html) =>
		sendEmail({
			to: [args.email],
			subject: bookingRescheduledCustomerEmailSubject(args),
			html
		}).map(() => null)
	);
}

export function sendSessionReminderEmail(
	args: Parameters<typeof renderSessionReminderEmailHtml>[0]
) {
	return renderSessionReminderEmailHtml(args).andThen((html) =>
		sendEmail({
			to: [args.email, ...getHostEmails()],
			subject: sessionReminderEmailSubject(args),
			html
		}).map(() => null)
	);
}
