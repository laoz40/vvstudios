"use node";

import { type ResultAsync } from "neverthrow";
import { emailDomainCanReceiveMailAsync } from "#convex/shared/lib/email/emailDomain";
import { validateBookingEmailDomain } from "#convex/shared/lib/bookingEmailDomainSteps";

export function requireBookingEmailDomain(
	email: string
): ResultAsync<null, { reason: "BOOKING_EMAIL_DOMAIN_INVALID" }> {
	return emailDomainCanReceiveMailAsync(email).andThen(validateBookingEmailDomain);
}
