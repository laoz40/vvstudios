"use node";

import { ok, safeTry } from "neverthrow";
import { emailDomainCanReceiveMailAsync } from "#convex/shared/lib/email/emailDomain";
import { validateBookingEmailDomain } from "#convex/shared/lib/bookingEmailDomainSteps";

export function requireBookingEmailDomain(email: string) {
	return safeTry(async function* () {
		const canReceiveMail = yield* emailDomainCanReceiveMailAsync(email);
		yield* validateBookingEmailDomain(canReceiveMail);

		return ok(null);
	});
}
