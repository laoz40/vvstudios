"use node";

import { errAsync } from "neverthrow";
import { inviteEmployeeAfterDomainCheck, parseInviteEmail } from "#convex/lib/clerkInvitations";
import {
	emailDomainCanReceiveMailAsync,
	rejectUninvitableEmailDomain
} from "#convex/lib/email/emailDomain";

export function inviteEmployeeByEmail(emailInput: string) {
	const parsedEmail = parseInviteEmail(emailInput);

	if (parsedEmail.isErr()) {
		return errAsync(parsedEmail.error);
	}

	const email = parsedEmail.value;

	return emailDomainCanReceiveMailAsync(email)
		.andThen(rejectUninvitableEmailDomain(email))
		.andThen(inviteEmployeeAfterDomainCheck);
}
