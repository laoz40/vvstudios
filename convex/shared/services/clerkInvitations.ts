"use node";

import {
	requestClerkInvitation,
	readClerkInvitationBody,
	validateClerkInvitationResponse
} from "#convex/shared/lib/clerkInvitations";

function finishClerkInvitation(response: Response) {
	return readClerkInvitationBody(response).andThen((body) =>
		validateClerkInvitationResponse(response, body)
	);
}

export function createClerkInvitation(email: string) {
	return requestClerkInvitation(email).andThen(finishClerkInvitation);
}

export function inviteEmployeeAfterDomainCheck(email: string) {
	return createClerkInvitation(email).map(() => ({ invitedEmail: email }));
}
