"use node";

import { ok, safeTry } from "neverthrow";

import {
	requestClerkInvitation,
	readClerkInvitationBody,
	validateClerkInvitationResponse
} from "#convex/shared/lib/clerkInvitations";

function finishClerkInvitation(response: Response) {
	return safeTry(async function* () {
		const body = yield* readClerkInvitationBody(response);
		const invitation = yield* validateClerkInvitationResponse(response, body);

		return ok(invitation);
	});
}

export function createClerkInvitation(email: string) {
	return safeTry(async function* () {
		const response = yield* requestClerkInvitation(email);
		const invitation = yield* finishClerkInvitation(response);

		return ok(invitation);
	});
}

export function inviteEmployeeAfterDomainCheck(email: string) {
	return safeTry(async function* () {
		yield* createClerkInvitation(email);

		return ok({ invitedEmail: email });
	});
}
