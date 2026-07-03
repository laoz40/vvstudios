"use node";

import { v } from "convex/values";
import { err, ok, type Result } from "../src/lib/result";
import { internal } from "./_generated/api";
import { action, internalAction, type ActionCtx } from "./_generated/server";
import { formatDateValue, startOfToday } from "../src/sites/studio/lib/bookingdatetime";
import { getGoogleCalendarClient } from "./lib/googleCalendarClient";
import {
	getDateAvailabilityRange,
	groupBusyDaysByMonth,
	groupBusyWindowsByDay,
	isTimeSlotAvailable,
	type BusyDayWindow
} from "./lib/bookingCalendarTime";
import { getBusyWindows, getBusyWindowsInRange } from "./lib/googleCalendarAvailability";
import { checkGoogleCalendarAvailabilityRateLimit } from "./lib/rateLimits";
import { getGoogleCalendarErrorCode } from "./lib/googleCalendarErrors";
import type { ValidPackage, ValidPackageByTokenError } from "./packageScheduling";
import {
	createBookingCalendarEvent,
	deleteBookingCalendarEvent,
	updateBookingCalendarEventTiming,
	type BookingCalendarEventRecord
} from "./lib/googleCalendarEvents";

export const getPackageBusyWindows = action({
	args: { token: v.string(), rateLimitKey: v.string() },
	handler: (ctx, args) => getPackageBusyWindowsHandler(ctx, args)
});

async function getPackageBusyWindowsHandler(
	ctx: ActionCtx,
	args: { rateLimitKey: string; token: string }
): Promise<
	Result<
		{
			busyWindowsByMonth: Record<string, BusyDayWindow[]>;
			packageExpiresAt: number;
			timeZone: string;
		},
		| ValidPackageByTokenError
		| { reason: "GOOGLE_CALENDAR_AVAILABILITY_FAILED" }
		| { reason: "GOOGLE_CALENDAR_AUTH_FAILED" }
		| { reason: "GOOGLE_CALENDAR_RATE_LIMITED" }
	>
> {
	const [lookupError, multiBooking]: Result<ValidPackage, ValidPackageByTokenError> =
		await ctx.runQuery(internal.packageScheduling.getValidPackageByTokenInternal, {
			now: Date.now(),
			token: args.token
		});

	if (lookupError !== null) {
		return err(lookupError);
	}

	const [rateLimitError] = await checkGoogleCalendarAvailabilityRateLimit(ctx, args.rateLimitKey);

	if (rateLimitError !== null) {
		return err(rateLimitError);
	}

	try {
		const { calendar, calendarIds, timeZone } = getGoogleCalendarClient();
		const startDate = formatDateValue(startOfToday());
		const endDate = formatDateValue(new Date(multiBooking.expiresAt));
		const [rangeError, availabilityRange] = getDateAvailabilityRange(startDate, endDate, timeZone);

		if (rangeError !== null) {
			return err({ reason: "GOOGLE_CALENDAR_AVAILABILITY_FAILED" });
		}

		const busyWindows = await getBusyWindowsInRange({
			calendar,
			calendarIds,
			timeMax: availabilityRange.timeMax,
			timeMin: availabilityRange.timeMin,
			timeZone
		});
		const [busyDaysError, busyDays] = groupBusyWindowsByDay(busyWindows, timeZone);

		if (busyDaysError !== null) {
			return err({ reason: "GOOGLE_CALENDAR_AVAILABILITY_FAILED" });
		}

		return ok({
			busyWindowsByMonth: groupBusyDaysByMonth(busyDays),
			packageExpiresAt: multiBooking.expiresAt,
			timeZone
		});
	} catch (error) {
		return err({
			reason: getGoogleCalendarErrorCode(error, "GOOGLE_CALENDAR_AVAILABILITY_FAILED")
		});
	}
}

export type GetPackageBusyWindowsResult = Awaited<ReturnType<typeof getPackageBusyWindowsHandler>>;

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
	addons: v.array(v.string()),
	date: v.string(),
	duration: v.string(),
	email: v.string(),
	eventBufferMinutes: v.number(),
	name: v.string(),
	service: v.string(),
	time: v.string()
});

export const savePackageSlotCalendarEventInternal = internalAction({
	args: {
		booking: v.union(v.null(), packageCalendarBookingValidator),
		details: packageCalendarDetailsValidator
	},
	handler: async (ctx, args) => savePackageSlotCalendarEventInternalHandler(ctx, args)
});

async function savePackageSlotCalendarEventInternalHandler(
	_ctx: ActionCtx,
	args: {
		booking: BookingCalendarEventRecord | null;
		details: {
			addons: string[];
			date: string;
			duration: string;
			email: string;
			eventBufferMinutes: number;
			name: string;
			service: string;
			time: string;
		};
	}
): Promise<
	Result<
		{ googleCalendarId?: string; googleEventId?: string },
		| { reason: "BOOKING_TIME_UNAVAILABLE" }
		| { reason: "GOOGLE_CALENDAR_AUTH_FAILED" }
		| { reason: "GOOGLE_CALENDAR_CREATE_FAILED" }
		| { reason: "GOOGLE_CALENDAR_RATE_LIMITED" }
		| { reason: "GOOGLE_CALENDAR_UPDATE_FAILED" }
	>
> {
	try {
		const { calendar, calendarId, calendarIds, timeZone } = getGoogleCalendarClient();
		const ignoredEvent = args.booking
			? { calendarId: args.booking.googleCalendarId, eventId: args.booking.googleEventId }
			: undefined;
		const busyWindows = await getBusyWindows({
			calendar,
			calendarIds,
			date: args.details.date,
			ignoredEvent,
			timeZone
		});
		const isAvailable = isTimeSlotAvailable({
			busyWindows,
			date: args.details.date,
			duration: args.details.duration,
			eventBufferMinutes: args.details.eventBufferMinutes,
			time: args.details.time,
			timeZone
		});

		if (!isAvailable) {
			return err({ reason: "BOOKING_TIME_UNAVAILABLE" });
		}

		const calendarClient = { calendar, calendarId, timeZone };
		const eventDetails = {
			addons: args.details.addons,
			duration: args.details.duration,
			email: args.details.email,
			name: args.details.name,
			service: args.details.service
		};

		if (args.booking) {
			const [updateError, updateResult] = await updateBookingCalendarEventTiming({
				booking: args.booking,
				client: calendarClient,
				createMissingEvent: true,
				date: args.details.date,
				details: eventDetails,
				time: args.details.time
			});

			if (updateError !== null) {
				return err(updateError);
			}

			return ok({
				...((updateResult.googleCalendarId ?? args.booking.googleCalendarId)
					? { googleCalendarId: updateResult.googleCalendarId ?? args.booking.googleCalendarId }
					: {}),
				...((updateResult.googleEventId ?? args.booking.googleEventId)
					? { googleEventId: updateResult.googleEventId ?? args.booking.googleEventId }
					: {})
			});
		}

		const [createError, createResult] = await createBookingCalendarEvent({
			client: calendarClient,
			date: args.details.date,
			details: eventDetails,
			time: args.details.time
		});

		if (createError !== null) {
			return err(createError);
		}

		return ok({
			...(createResult.googleCalendarId ? { googleCalendarId: createResult.googleCalendarId } : {}),
			...(createResult.googleEventId ? { googleEventId: createResult.googleEventId } : {})
		});
	} catch (error) {
		return err({ reason: getGoogleCalendarErrorCode(error, "GOOGLE_CALENDAR_CREATE_FAILED") });
	}
}

export const deletePackageSlotCalendarEventInternal = internalAction({
	args: { booking: packageCalendarBookingValidator },
	handler: async (_ctx, args) => {
		const { calendar, calendarId, timeZone } = getGoogleCalendarClient();
		return await deleteBookingCalendarEvent({
			booking: args.booking,
			client: { calendar, calendarId, timeZone }
		});
	}
});
