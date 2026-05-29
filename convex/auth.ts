import { query } from "./_generated/server";
import { isAdminIdentity } from "./lib/auth";

export const getCurrentUserAccess = query({
	args: {},
	handler: async (ctx) => {
		const identity = await ctx.auth.getUserIdentity();

		if (!identity) {
			return { isAuthenticated: false, isAdmin: false };
		}

		return { isAuthenticated: true, isAdmin: isAdminIdentity(identity) };
	},
});
