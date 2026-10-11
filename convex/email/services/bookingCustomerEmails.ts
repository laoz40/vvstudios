import {
	renderBookingRescheduledCustomerEmailHtml,
	renderSessionReminderEmailHtml,
	type SendBookingRescheduledCustomerEmailArgs
} from "#convex/shared/lib/email/emailRenders";

import {
	sendBookingRescheduledCustomerEmailWithHtml,
	sendSessionReminderEmailWithHtml
} from "#convex/email/lib/bookingCustomerEmailsSteps";

export function sendBookingRescheduledCustomerEmail(args: SendBookingRescheduledCustomerEmailArgs) {
	return renderBookingRescheduledCustomerEmailHtml(args).andThen((html: string) =>
		sendBookingRescheduledCustomerEmailWithHtml(args, html)
	);
}

export function sendSessionReminderEmail(
	args: Parameters<typeof renderSessionReminderEmailHtml>[0]
) {
	return renderSessionReminderEmailHtml(args).andThen((html: string) =>
		sendSessionReminderEmailWithHtml(args, html)
	);
}
