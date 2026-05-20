import { mutation, query } from "./_generated/server";
import {
	assertAuthenticated,
	bookingSettingsArgs,
	DEFAULT_BOOKING_SETTINGS,
	validateBookingSettings,
} from "./lib/bookingSettings";

export const get = query({
	args: {},
	handler: async (ctx) => {
		const settings = await ctx.db
			.query("bookingSettings")
			.withIndex("by_key", (q) => q.eq("key", "main"))
			.unique();
		return settings ?? DEFAULT_BOOKING_SETTINGS;
	},
});

export const update = mutation({
	args: bookingSettingsArgs,
	handler: async (ctx, args) => {
		const identity = await ctx.auth.getUserIdentity();
		assertAuthenticated(identity);
		validateBookingSettings(args);

		const existing = await ctx.db
			.query("bookingSettings")
			.withIndex("by_key", (q) => q.eq("key", "main"))
			.unique();
		const value = { ...args, key: "main", updatedAt: Date.now(), updatedBy: identity?.email };

		if (existing) {
			await ctx.db.patch(existing._id, value);
		} else {
			await ctx.db.insert("bookingSettings", value);
		}

		return { ok: true as const };
	},
});
