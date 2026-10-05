"use node";

import { errAsync, okAsync } from "neverthrow";
import { emailDomainCanReceiveMailAsync } from "#convex/lib/email/emailDomain";
import { createClerkInvitation, parseInviteEmail } from "#convex/lib/clerkInvitations";

function requireInvitableEmailDomain(email: string) {
	return (canReceiveMail: boolean) =>
		canReceiveMail ? okAsync(email) : errAsync({ reason: "EMAIL_DOMAIN_INVALID" as const });
}

function mapClerkInvitationToInvitedEmail(email: string) {
	return () => ({ invitedEmail: email });
}

function createClerkInvitationAfterDomainCheck(email: string) {
	return createClerkInvitation(email).map(mapClerkInvitationToInvitedEmail(email));
}

export function inviteEmployeeByEmail(emailInput: string) {
	const parsedEmail = parseInviteEmail(emailInput);

	if (parsedEmail.isErr()) {
		return errAsync(parsedEmail.error);
	}

	const email = parsedEmail.value;

	return emailDomainCanReceiveMailAsync(email)
		.andThen(requireInvitableEmailDomain(email))
		.andThen(createClerkInvitationAfterDomainCheck);
}
