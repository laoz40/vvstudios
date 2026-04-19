import { v } from "convex/values";
import { internalMutation, query } from "./_generated/server";

export const storeBooking = internalMutation({
	args: {
		name: v.string(),
		phone: v.string(),
		accountName: v.string(),
		abn: v.optional(v.string()),
		email: v.string(),
		date: v.string(),
		time: v.string(),
		duration: v.string(),
		service: v.string(),
		addons: v.array(v.string()),
		notes: v.optional(v.string()),
		googleEventId: v.optional(v.string()),
		googleCalendarId: v.optional(v.string()),
	},
	handler: async (ctx, args) => {
		return await ctx.db.insert("bookings", {
			name: args.name,
			phone: args.phone,
			accountName: args.accountName,
			abn: args.abn,
			email: args.email,
			date: args.date,
			time: args.time,
			duration: args.duration,
			service: args.service,
			addons: args.addons,
			notes: args.notes,
			googleEventId: args.googleEventId,
			googleCalendarId: args.googleCalendarId,
			createdAt: Date.now(),
		});
	},
});

export const getBookings = query({
	args: {},
	handler: async (ctx) => {
		const identity = await ctx.auth.getUserIdentity();

		if (!identity) {
			throw new Error("Not authenticated");
		}

		return await ctx.db.query("bookings").withIndex("by_createdAt").order("desc").take(100);
	},
});
