import {
	renderBookingRescheduledCustomerEmailHtml,
	renderSessionReminderEmailHtml,
	bookingRescheduledCustomerEmailSubject,
	sessionReminderEmailSubject,
	type SendBookingRescheduledCustomerEmailArgs
} from "#convex/lib/email/emailRenders";
import { getHostEmails, sendEmail } from "#convex/lib/email/emailSend";

function returnNull(): null {
	return null;
}

function sendBookingRescheduledCustomerEmailWithHtml(
	args: SendBookingRescheduledCustomerEmailArgs
) {
	return (html: string) =>
		sendEmail({
			to: [args.email],
			subject: bookingRescheduledCustomerEmailSubject(args),
			html
		}).map(returnNull);
}

export function sendBookingRescheduledCustomerEmail(args: SendBookingRescheduledCustomerEmailArgs) {
	return renderBookingRescheduledCustomerEmailHtml(args).andThen(
		sendBookingRescheduledCustomerEmailWithHtml(args)
	);
}

function sendSessionReminderEmailWithHtml(
	args: Parameters<typeof renderSessionReminderEmailHtml>[0]
) {
	return (html: string) =>
		sendEmail({
			to: [args.email, ...getHostEmails()],
			subject: sessionReminderEmailSubject(args),
			html
		}).map(returnNull);
}

export function sendSessionReminderEmail(
	args: Parameters<typeof renderSessionReminderEmailHtml>[0]
) {
	return renderSessionReminderEmailHtml(args).andThen(sendSessionReminderEmailWithHtml(args));
}
