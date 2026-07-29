import { v } from "convex/values";
import { mutation, query, type MutationCtx } from "./_generated/server";
import { err as tupleErr, ok as tupleOk } from "#/lib/result";
import { DEFAULT_BOOKING_AVAILABILITY_SETTINGS } from "#studio/lib/bookingAvailabilitySettings";
import type { BookingAvailabilitySettings } from "#studio/lib/bookingAvailabilitySettings";
import { updateBookingSettingsService } from "./services/bookingSettings";

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

function updateBookingSettingsHandler(ctx: MutationCtx, args: BookingAvailabilitySettings) {
	return updateBookingSettingsService(ctx, args).match(tupleOk, tupleErr);
}

export type UpdateBookingSettingsResult = Awaited<ReturnType<typeof updateBookingSettingsHandler>>;
