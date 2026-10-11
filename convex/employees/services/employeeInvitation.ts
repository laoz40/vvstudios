"use node";

import { inviteEmployeeAfterDomainCheck } from "#convex/shared/services/clerkInvitations";

import { parseInviteEmail } from "#convex/shared/lib/clerkInvitations";
import {
	emailDomainCanReceiveMailAsync,
	rejectUninvitableEmailDomain
} from "#convex/shared/lib/email/emailDomain";

function inviteValidatedEmail(email: string) {
	return emailDomainCanReceiveMailAsync(email)
		.andThen((canReceiveMail) => rejectUninvitableEmailDomain(email, canReceiveMail))
		.andThen(inviteEmployeeAfterDomainCheck);
}

export function inviteEmployeeByEmail(emailInput: string) {
	return parseInviteEmail(emailInput).asyncAndThen(inviteValidatedEmail);
}
