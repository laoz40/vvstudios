import { v } from "convex/values";
import { mutation, query } from "#convex/_generated/server";
import { tupleErr, tupleOk } from "#/lib/result";
import { getBookingAvailabilitySettings } from "#convex/lib/booking/bookingSettings";
import { updateBookingSettingsService } from "#convex/services/booking/bookingSettings";

export const get = query({
	args: {},
	handler: (ctx) =>
		getBookingAvailabilitySettings(ctx).match(
			(settings) => settings,
			() => {
				throw new Error("Failed to load booking availability settings");
			}
		)
});

export const update = mutation({
	args: {
		eventBufferMinutes: v.number(),
		leadTimeMinutes: v.number(),
		maxDaysAhead: v.number(),
		weekSchedule: v.array(v.object({ endTime: v.string(), startTime: v.string() }))
	},
	handler: (ctx, args) => updateBookingSettingsService(ctx, args).match(tupleOk, tupleErr)
});
