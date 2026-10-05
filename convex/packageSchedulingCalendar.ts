"use node";

import { v } from "convex/values";
import { tupleErr, tupleOk, type Result } from "#/lib/result";
import { DURATION_OPTIONS, SERVICES } from "#studio/features/booking-form/lib/booking-form-model";
import { action, internalAction } from "#convex/_generated/server";
import type { SessionCalendarEventRecord } from "#convex/lib/sessions/sessionCalendarEventPayload";
import {
	loadPackageCalendarClientWhenSlotOpen,
	removePackageSessionGoogleCalendarEvent,
	writePackageSessionGoogleCalendarEvent,
	type PackageCalendarWriteError
} from "#convex/services/googleCalendar/packageSchedulingCalendar";
import {
	groupPackageBusyWindowsByMonth,
	loadPackageBookableRangeBusyWindows,
	loadValidPackageForCalendarAvailability,
	type PackageAvailabilityError
} from "#convex/services/googleCalendar/packageCalendarAvailabilityWorkflow";
import type { BusyDayWindow } from "#convex/lib/sessions/sessionCalendarTime";
import { bookingAddonsValidator } from "#convex/lib/booking/bookingAddonQuantities";

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

type SavePackageSessionCalendarEventArgs = {
	session: SessionCalendarEventRecord | null;
	details: Parameters<typeof writePackageSessionGoogleCalendarEvent>[1]["details"];
};

async function savePackageSessionCalendarEventHandler(
	args: SavePackageSessionCalendarEventArgs
): Promise<
	Result<{ googleCalendarId?: string; googleEventId?: string }, PackageCalendarWriteError>
> {
	return await loadPackageCalendarClientWhenSlotOpen(args)
		.andThen((client) => writePackageSessionGoogleCalendarEvent(client, args))
		.match(tupleOk, tupleErr);
}

export const createPackageSessionCalendarEvent = internalAction({
	args: {
		session: v.union(v.null(), packageCalendarBookingValidator),
		details: packageCalendarDetailsValidator
	},
	handler: (_ctx, args) => savePackageSessionCalendarEventHandler(args)
});

export const updatePackageSessionCalendarEvent = internalAction({
	args: { session: packageCalendarBookingValidator, details: packageCalendarDetailsValidator },
	handler: (_ctx, args) => savePackageSessionCalendarEventHandler(args)
});

export const deletePackageSessionCalendarEvent = internalAction({
	args: { session: packageCalendarBookingValidator },
	handler: (_ctx, args) =>
		removePackageSessionGoogleCalendarEvent(args.session).match(tupleOk, tupleErr)
});
