"use node";

import { v } from "convex/values";
import { tupleErr, tupleOk, type Result } from "#/lib/result";
import { DURATION_OPTIONS, SERVICES } from "#studio/features/booking-form/lib/booking-form-model";
import { action, internalAction } from "#convex/_generated/server";
import { bookingAddonsValidator } from "#convex/services/booking/bookingFormValidators";
import {
	groupPackageBusyWindowsByMonth,
	loadPackageBookableRangeBusyWindows,
	loadValidPackageForCalendarAvailability,
	type BusyDayWindow,
	type PackageAvailabilityError
} from "#convex/services/googleCalendar/packageCalendarAvailabilityWorkflow";
import {
	removePackageSessionGoogleCalendarEvent,
	syncPackageSessionGoogleCalendarEvent,
	type SessionCalendarEventRecord
} from "#convex/services/googleCalendar/packageSchedulingCalendar";

const packageCalendarBookingValidator = v.object({
	date: v.string(),
	duration: v.string(),
	email: v.string(),
	googleCalendarId: v.optional(v.string()),
	googleEventId: v.optional(v.string()),
	name: v.string(),
	time: v.string()
});

const packageCalendarDetailsValidator = v.object({
	addons: bookingAddonsValidator,
	date: v.string(),
	duration: v.union(...DURATION_OPTIONS.map((duration) => v.literal(duration))),
	email: v.string(),
	eventBufferMinutes: v.number(),
	name: v.string(),
	service: v.union(...SERVICES.map((service) => v.literal(service))),
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
	handler: (_ctx, args) =>
		syncPackageSessionGoogleCalendarEvent(
			args as {
				session: SessionCalendarEventRecord | null;
				details: Parameters<typeof syncPackageSessionGoogleCalendarEvent>[0]["details"];
			}
		).match(tupleOk, tupleErr)
});

export const updatePackageSessionCalendarEvent = internalAction({
	args: { session: packageCalendarBookingValidator, details: packageCalendarDetailsValidator },
	handler: (_ctx, args) =>
		syncPackageSessionGoogleCalendarEvent({
			session: args.session as SessionCalendarEventRecord,
			details: args.details as Parameters<
				typeof syncPackageSessionGoogleCalendarEvent
			>[0]["details"]
		}).match(tupleOk, tupleErr)
});

export const deletePackageSessionCalendarEvent = internalAction({
	args: { session: packageCalendarBookingValidator },
	handler: (_ctx, args) =>
		removePackageSessionGoogleCalendarEvent(args.session as SessionCalendarEventRecord).match(
			tupleOk,
			tupleErr
		)
});
