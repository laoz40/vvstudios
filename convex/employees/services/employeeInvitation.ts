"use node";

import { inviteEmployeeAfterDomainCheck } from "#convex/shared/services/clerkInvitations";

import { parseInviteEmail } from "#convex/shared/lib/clerkInvitations";
import {
	emailDomainCanReceiveMailAsync,
	rejectUninvitableEmailDomain
} from "#convex/shared/lib/email/emailDomain";
import { ok, safeTry } from "neverthrow";

export function inviteEmployeeByEmail(emailInput: string) {
	return safeTry(async function* () {
		const email = yield* parseInviteEmail(emailInput);
		const canReceiveMail = yield* emailDomainCanReceiveMailAsync(email);
		yield* rejectUninvitableEmailDomain(email, canReceiveMail);
		const invitation = yield* inviteEmployeeAfterDomainCheck(email);

		return ok(invitation);
	});
}
