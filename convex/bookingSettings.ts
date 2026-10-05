import { v } from "convex/values";
import { mutation, query } from "#convex/_generated/server";
import { tupleErr, tupleOk } from "#/lib/result";
import {
	readBookingAvailabilitySettings,
	validateBookingSettings
} from "#convex/lib/booking/bookingSettings";
import { requirePermission } from "#convex/services/auth";
import { persistBookingAvailabilitySettings } from "#convex/services/booking/bookingSettings";

export const get = query({ args: {}, handler: (ctx) => readBookingAvailabilitySettings(ctx) });

export const update = mutation({
	args: {
		eventBufferMinutes: v.number(),
		leadTimeMinutes: v.number(),
		maxDaysAhead: v.number(),
		weekSchedule: v.array(v.object({ endTime: v.string(), startTime: v.string() }))
	},
	handler: (ctx, args) =>
		requirePermission(ctx, "update:availability")
			.andThen((identity) => validateBookingSettings(args).map(() => identity.email ?? "unknown"))
			.andThen((updatedBy) => persistBookingAvailabilitySettings(ctx, args, updatedBy))
			.match(tupleOk, tupleErr)
});
