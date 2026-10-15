import { sendEmail } from "#convex/shared/lib/email/emailSend";
import {
	renderSessionReminderEmailHtml,
	bookingRescheduledCustomerEmailSubject,
	sessionReminderEmailSubject,
	type SendBookingRescheduledCustomerEmailArgs
} from "#convex/shared/lib/email/emailRenders";
import { getHostEmails } from "#convex/shared/lib/email/emailSend";

export function sendBookingRescheduledCustomerEmailWithHtml(
	args: SendBookingRescheduledCustomerEmailArgs,

	html: string
) {
	return sendEmail({
		to: [args.email],
		subject: bookingRescheduledCustomerEmailSubject(args),
		html,
		logContext: { operation: "email.sendBookingRescheduledCustomer", bookingId: args.bookingId }
	}).map(() => null);
}

export function sendSessionReminderEmailWithHtml(
	args: Parameters<typeof renderSessionReminderEmailHtml>[0],

	html: string
) {
	return sendEmail({
		to: [args.email, ...getHostEmails()],
		subject: sessionReminderEmailSubject(args),
		html,
		logContext: { operation: "email.sendSessionReminder", bookingId: args.bookingId }
	}).map(() => null);
}
