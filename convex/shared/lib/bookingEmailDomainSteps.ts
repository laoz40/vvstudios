"use node";

import { errAsync, okAsync } from "neverthrow";

export function validateBookingEmailDomain(canReceiveMail: boolean) {
	return canReceiveMail
		? okAsync(null)
		: errAsync({ reason: "BOOKING_EMAIL_DOMAIN_INVALID" as const });
}
