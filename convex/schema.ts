import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
	bookings: defineTable({
		name: v.string(),
		email: v.string(),
		date: v.string(),
		time: v.optional(v.string()),
		duration: v.optional(v.string()),
		service: v.string(),
		addons: v.optional(v.array(v.string())),
		notes: v.optional(v.string()),
		googleEventId: v.optional(v.string()),
		googleCalendarId: v.optional(v.string()),
		createdAt: v.number(),
	}).index("by_createdAt", ["createdAt"]),
});
