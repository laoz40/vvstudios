"use node";

import { v } from "convex/values";
import { ok, safeTry } from "neverthrow";
import { tupleErr, tupleOk, type Result } from "#/lib/result";
import { action, internalAction } from "#convex/_generated/server";
import {
	groupPackageBusyWindowsByMonth,
	loadPackageBookableRangeBusyWindows,
	loadValidPackageForCalendarAvailability,
	type BusyDayWindow,
	type PackageAvailabilityError
} from "#convex/googleCalendar/services/packageAvailability";
import {
	removePackageSessionGoogleCalendarEvent,
	syncPackageSessionGoogleCalendarEvent
} from "#convex/googleCalendar/services/packageScheduling";
import { DURATION_OPTIONS, SERVICES } from "#/domain/booking/catalog";
import { bookingAddonQuantitiesValidator } from "#convex/sessions/checkout";
import { bookingAddonsValidator } from "#convex/schema";

export const packageCalendarDetailsValidator = v.object({
	addons: bookingAddonsValidator,
	...bookingAddonQuantitiesValidator,
	date: v.string(),
	duration: v.union(...DURATION_OPTIONS.map((duration) => v.literal(duration))),
	email: v.string(),
	eventBufferMinutes: v.number(),
	name: v.string(),
	service: v.union(...SERVICES.map((service) => v.literal(service))),
	time: v.string()
});

const packageCalendarBookingValidator = v.object({
	date: v.string(),
	duration: v.string(),
	email: v.string(),
	googleCalendarId: v.optional(v.string()),
	googleEventId: v.optional(v.string()),
	name: v.string(),
	time: v.string()
});

export const getPackageBusyWindows = action({
	args: { token: v.string(), rateLimitKey: v.string() },
	handler: async (
		ctx,
		args
	): Promise<
		Result<
			{
				busyWindowsByMonth: Record<string, BusyDayWindow[]>;
				packageExpiresAt: number;
				timeZone: string;
			},
			PackageAvailabilityError
		>
	> =>
		await safeTry(async function* () {
			const availability = yield* loadValidPackageForCalendarAvailability(ctx, args);
			const busyWindows = yield* loadPackageBookableRangeBusyWindows(availability);
			const groupedBusyWindows = yield* groupPackageBusyWindowsByMonth(busyWindows);

			return ok(groupedBusyWindows);
		}).match(tupleOk, tupleErr)
});

export const createPackageSessionCalendarEvent = internalAction({
	args: {
		session: v.union(v.null(), packageCalendarBookingValidator),
		details: packageCalendarDetailsValidator
	},
	handler: (_ctx, args) => syncPackageSessionGoogleCalendarEvent(args).match(tupleOk, tupleErr)
});

export const updatePackageSessionCalendarEvent = internalAction({
	args: { session: packageCalendarBookingValidator, details: packageCalendarDetailsValidator },
	handler: (_ctx, args) => syncPackageSessionGoogleCalendarEvent(args).match(tupleOk, tupleErr)
});

export const deletePackageSessionCalendarEvent = internalAction({
	args: { session: packageCalendarBookingValidator },
	handler: (_ctx, args) =>
		removePackageSessionGoogleCalendarEvent(args.session).match(tupleOk, tupleErr)
});
