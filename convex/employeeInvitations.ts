"use node";

import { err, ok } from "neverthrow";
import { v } from "convex/values";
import { tupleErr, tupleOk } from "#/lib/result";
import { action } from "#convex/_generated/server";
import { requirePermissionActions } from "#convex/services/auth";
import { emailDomainCanReceiveMailAsync } from "#convex/lib/email/emailDomain";
import { createClerkInvitation, parseInviteEmail } from "#convex/lib/clerkInvitations";

export const inviteUser = action({
	args: { email: v.string() },
	handler: async (ctx, args) =>
		await requirePermissionActions(ctx, "update:editor-access")
			.andThen(() => parseInviteEmail(args.email))
			.andThen((email) =>
				emailDomainCanReceiveMailAsync(email).andThen((canReceiveMail) =>
					canReceiveMail ? ok(email) : err({ reason: "EMAIL_DOMAIN_INVALID" as const })
				)
			)
			.andThen((email) => createClerkInvitation(email).map(() => ({ invitedEmail: email })))
			.match(tupleOk, tupleErr)
});
