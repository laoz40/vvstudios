import { v } from "convex/values";
import { ok, safeTry } from "neverthrow";
import { mutation, query } from "#convex/_generated/server";
import { tupleErr, tupleOk } from "#/lib/result";
import { requirePermission } from "#convex/shared/services/auth";
import {
	loadBookingAvailabilitySettings,
	writeBookingAvailabilitySettings
} from "#convex/booking/services/settings";

export const get = query({ args: {}, handler: (ctx) => loadBookingAvailabilitySettings(ctx) });

export const update = mutation({
	args: {
		eventBufferMinutes: v.number(),
		leadTimeMinutes: v.number(),
		maxDaysAhead: v.number(),
		weekSchedule: v.array(v.object({ endTime: v.string(), startTime: v.string() }))
	},
	handler: (ctx, args) =>
		safeTry(async function* () {
			const identity = yield* requirePermission(ctx, "update:availability");

			const settings = yield* writeBookingAvailabilitySettings(
				ctx,
				args,
				identity.email ?? "unknown"
			);

			return ok(settings);
		}).match(tupleOk, tupleErr)
});
