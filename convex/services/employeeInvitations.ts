"use node";

import { err, ok, type ResultAsync } from "neverthrow";
import type { ActionCtx } from "#convex/_generated/server";
import { requirePermissionActions } from "#convex/lib/auth";
import { emailDomainCanReceiveMail } from "#convex/lib/bookingSubmission";
import { createClerkInvitation, parseInviteEmail } from "#convex/lib/clerkInvitations";
import { okOrThrow } from "#convex/lib/result";

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
			okOrThrow(emailDomainCanReceiveMail(email)).andThen((canReceiveMail) =>
				canReceiveMail ? ok(email) : err({ reason: "EMAIL_DOMAIN_INVALID" as const })
			)
		)
		.andThen((email) => createClerkInvitation(email).map(() => ({ invitedEmail: email })));
}
