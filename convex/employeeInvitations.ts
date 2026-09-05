"use node";

import { v } from "convex/values";
import { tupleErr, tupleOk } from "#/lib/result";
import { action } from "#convex/_generated/server";
import { inviteUserService } from "#convex/services/employeeInvitations";

export const inviteUser = action({
	args: { email: v.string() },
	handler: (ctx, args) => inviteUserService(ctx, args).match(tupleOk, tupleErr)
});
