"use node";

import { ok, safeTry } from "neverthrow";
import { v } from "convex/values";
import { tupleErr, tupleOk, type Result } from "#/lib/result";
import { action } from "#convex/_generated/server";
import { requirePermissionActions } from "#convex/shared/services/requirePermissionActions";
import { inviteEmployeeByEmail } from "#convex/employees/services/employeeInvitation";

type InviteUserError =
	| { reason: "INVALID_EMAIL" }
	| { reason: "EMAIL_DOMAIN_INVALID" }
	| { reason: "USER_EXISTS" }
	| { reason: "INVITATION_PENDING" }
	| { reason: "CLERK_INVITATION_FAILED" }
	| { reason: "NOT_AUTHENTICATED" }
	| { reason: "NOT_AUTHORIZED" };

export const inviteUser = action({
	args: { email: v.string() },
	handler: (ctx, args): Promise<Result<{ invitedEmail: string }, InviteUserError>> =>
		safeTry(async function* () {
			yield* requirePermissionActions(ctx, "update:editor-access");
			const invitation = yield* inviteEmployeeByEmail(args.email);

			return ok(invitation);
		}).match(tupleOk, tupleErr)
});
