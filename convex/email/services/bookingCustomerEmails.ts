import {
	renderBookingRescheduledCustomerEmailHtml,
	renderSessionReminderEmailHtml,
	type SendBookingRescheduledCustomerEmailArgs
} from "#convex/shared/lib/email/emailRenders";

import {
	sendBookingRescheduledCustomerEmailWithHtml,
	sendSessionReminderEmailWithHtml
} from "#convex/email/lib/bookingCustomerEmailsSteps";
import { ok, safeTry } from "neverthrow";

export function sendBookingRescheduledCustomerEmail(args: SendBookingRescheduledCustomerEmailArgs) {
	return safeTry(async function* () {
		const html = yield* renderBookingRescheduledCustomerEmailHtml(args);
		const result = yield* sendBookingRescheduledCustomerEmailWithHtml(args, html);

		return ok(result);
	});
}

export function sendSessionReminderEmail(
	args: Parameters<typeof renderSessionReminderEmailHtml>[0]
) {
	return safeTry(async function* () {
		const html = yield* renderSessionReminderEmailHtml(args);
		const result = yield* sendSessionReminderEmailWithHtml(args, html);

		return ok(result);
	});
}
