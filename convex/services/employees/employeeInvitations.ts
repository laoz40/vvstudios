"use node";

import { err, ok, type ResultAsync } from "neverthrow";
import type { ActionCtx } from "#convex/_generated/server";
import { requirePermissionActions } from "#convex/services/auth";
import { emailDomainCanReceiveMailAsync } from "#convex/lib/email/emailDomain";
import { createClerkInvitation, parseInviteEmail } from "#convex/lib/clerkInvitations";

type InviteUserArgs = { email: string };

type InviteUserSuccess = { invitedEmail: string };

type InviteUserError =
	| { reason: "NOT_AUTHENTICATED" }
	| { reason: "NOT_AUTHORIZED" }
	| { reason: "INVALID_EMAIL" }
	| { reason: "EMAIL_DOMAIN_INVALID" }
	| { reason: "USER_EXISTS" }
	| { reason: "INVITATION_PENDING" }
	| { reason: "CLERK_INVITATION_FAILED" };

export function inviteUserService(
	ctx: ActionCtx,
	args: InviteUserArgs
): ResultAsync<InviteUserSuccess, InviteUserError> {
	return requirePermissionActions(ctx, "update:editor-access")
		.andThen(() => parseInviteEmail(args.email))
		.andThen((email) =>
			emailDomainCanReceiveMailAsync(email).andThen((canReceiveMail) =>
				canReceiveMail ? ok(email) : err({ reason: "EMAIL_DOMAIN_INVALID" as const })
			)
		)
		.andThen((email) => createClerkInvitation(email).map(() => ({ invitedEmail: email })));
}
