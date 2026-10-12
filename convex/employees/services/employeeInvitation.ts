"use node";

import { ok, safeTry } from "neverthrow";

import { inviteEmployeeAfterDomainCheck } from "#convex/shared/services/clerkInvitations";

import { parseInviteEmail } from "#convex/shared/lib/clerkInvitations";
import {
	emailDomainCanReceiveMailAsync,
	rejectUninvitableEmailDomain
} from "#convex/shared/lib/email/emailDomain";

function inviteValidatedEmail(email: string) {
	return safeTry(async function* () {
		const canReceiveMail = yield* emailDomainCanReceiveMailAsync(email);
		const validatedEmail = yield* rejectUninvitableEmailDomain(email, canReceiveMail);
		const invitation = yield* inviteEmployeeAfterDomainCheck(validatedEmail);

		return ok(invitation);
	});
}

export function inviteEmployeeByEmail(emailInput: string) {
	return safeTry(async function* () {
		const email = yield* parseInviteEmail(emailInput);
		const invitation = yield* inviteValidatedEmail(email);

		return ok(invitation);
	});
}
