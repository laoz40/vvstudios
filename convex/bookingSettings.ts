import { v } from "convex/values";
import { mutation, query, type MutationCtx } from "./_generated/server";
import { err, ok } from "../src/lib/result";
import { DEFAULT_BOOKING_AVAILABILITY_SETTINGS } from "../src/sites/studio/lib/bookingAvailabilitySettings";
import type { BookingAvailabilitySettings } from "../src/sites/studio/lib/bookingAvailabilitySettings";
import { getAdminIdentity } from "./lib/auth";
import { isValidBookingSettings } from "./lib/bookingSettings";

export const get = query({
	args: {},
	handler: async (ctx) => {
		const settings = await ctx.db
			.query("bookingSettings")
			.withIndex("by_key", (q) => q.eq("key", "main"))
			.unique();
		return settings ?? DEFAULT_BOOKING_AVAILABILITY_SETTINGS;
	}
});

export const update = mutation({
	args: {
		eventBufferMinutes: v.number(),
		leadTimeMinutes: v.number(),
		maxDaysAhead: v.number(),
		weekSchedule: v.array(v.object({ endTime: v.string(), startTime: v.string() }))
	},
	handler: (ctx, args) => updateBookingSettingsHandler(ctx, args)
});

async function updateBookingSettingsHandler(ctx: MutationCtx, args: BookingAvailabilitySettings) {
	const [authError, identity] = await getAdminIdentity(ctx);

	if (authError !== null) {
		return err(authError);
	}

	if (!isValidBookingSettings(args)) {
		return err({ reason: "INVALID_BOOKING_SETTINGS" });
	}

	const existing = await ctx.db
		.query("bookingSettings")
		.withIndex("by_key", (q) => q.eq("key", "main"))
		.unique();
	const value = { ...args, key: "main", updatedAt: Date.now(), updatedBy: identity.email };

	try {
		if (existing) {
			await ctx.db.patch(existing._id, value);
		} else {
			await ctx.db.insert("bookingSettings", value);
		}
	} catch {
		return err({ reason: "BOOKING_SETTINGS_UPDATE_FAILED" });
	}

	return ok({ updated: true });
}

export type UpdateBookingSettingsResult = Awaited<ReturnType<typeof updateBookingSettingsHandler>>;
