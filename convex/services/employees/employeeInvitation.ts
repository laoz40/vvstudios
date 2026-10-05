"use node";

import { errAsync, okAsync } from "neverthrow";
import { emailDomainCanReceiveMailAsync } from "#convex/lib/email/emailDomain";
import { createClerkInvitation, parseInviteEmail } from "#convex/lib/clerkInvitations";

export function inviteEmployeeByEmail(emailInput: string) {
	const parsedEmail = parseInviteEmail(emailInput);

	if (parsedEmail.isErr()) {
		return errAsync(parsedEmail.error);
	}

	return emailDomainCanReceiveMailAsync(parsedEmail.value)
		.andThen((canReceiveMail) =>
			canReceiveMail
				? okAsync(parsedEmail.value)
				: errAsync({ reason: "EMAIL_DOMAIN_INVALID" as const })
		)
		.andThen((email) => createClerkInvitation(email).map(() => ({ invitedEmail: email })));
}
