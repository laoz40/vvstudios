"use node";

import { v } from "convex/values";
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
import { packageCalendarDetailsValidator } from "#convex/googleCalendar/services/packageDetails";

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
		await loadValidPackageForCalendarAvailability(ctx, args)
			.andThen(loadPackageBookableRangeBusyWindows)
			.andThen(groupPackageBusyWindowsByMonth)
			.match(tupleOk, tupleErr)
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
