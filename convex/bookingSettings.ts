import { v } from "convex/values";
import { mutation, query } from "#convex/_generated/server";
import { tupleErr, tupleOk } from "#/lib/result";
import { requirePermission } from "#convex/services/auth";
import {
	loadBookingAvailabilitySettings,
	validateBookingAvailabilitySettings,
	writeBookingAvailabilitySettings
} from "#convex/services/booking/bookingSettings";

export const get = query({ args: {}, handler: (ctx) => loadBookingAvailabilitySettings(ctx) });

export const update = mutation({
	args: {
		eventBufferMinutes: v.number(),
		leadTimeMinutes: v.number(),
		maxDaysAhead: v.number(),
		weekSchedule: v.array(v.object({ endTime: v.string(), startTime: v.string() }))
	},
	handler: (ctx, args) =>
		requirePermission(ctx, "update:availability")
			.andThen((identity) =>
				validateBookingAvailabilitySettings(args).map(() => identity.email ?? "unknown")
			)
			.andThen((updatedBy) => writeBookingAvailabilitySettings(ctx, args, updatedBy))
			.match(tupleOk, tupleErr)
});
