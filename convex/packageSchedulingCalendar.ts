"use node";

import { v } from "convex/values";
import { err, ok, type Result } from "../src/lib/result";
import {
	DURATION_OPTIONS,
	SERVICES
} from "../src/sites/studio/features/booking-form/lib/booking-form-model";
import { formatDateValue, startOfToday } from "../src/sites/studio/lib/bookingdatetime";
import { internal } from "./_generated/api";
import { action, internalAction, type ActionCtx } from "./_generated/server";
import {
	getDateAvailabilityRange,
	groupBusyDaysByMonth,
	groupBusyWindowsByDay,
	type BusyDayWindow
} from "./lib/sessionCalendarTime";
import { getBusyWindowsInRange } from "./lib/googleCalendarAvailability";
import { getGoogleCalendarClient } from "./lib/googleCalendarClient";
import { getGoogleCalendarErrorCode } from "./lib/googleCalendarErrors";
import {
	deleteSessionCalendarEvent,
	type SessionCalendarEventRecord
} from "./lib/sessionCalendarEvents";
import type { ValidPackage, ValidPackageByTokenError } from "./lib/packageScheduling";
import { savePackageSessionCalendarEvent } from "./lib/packageSchedulingCalendar";
import { checkGoogleCalendarAvailabilityRateLimit } from "./lib/rateLimits";

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
	duration: v.union(...DURATION_OPTIONS.map((duration) => v.literal(duration))),
	email: v.string(),
	eventBufferMinutes: v.number(),
	name: v.string(),
	service: v.union(...SERVICES.map((service) => v.literal(service))),
	time: v.string()
});

type GetPackageBusyWindowsArgs = { rateLimitKey: string; token: string };

export const getPackageBusyWindows = action({
	args: { token: v.string(), rateLimitKey: v.string() },
	handler: (ctx, args) => getPackageBusyWindowsHandler(ctx, args)
});

async function getPackageBusyWindowsHandler(
	ctx: ActionCtx,
	args: GetPackageBusyWindowsArgs
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
		await ctx.runQuery(internal.packageScheduling.getValidPackageByToken, {
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

export const createPackageSessionCalendarEvent = internalAction({
	args: {
		session: v.union(v.null(), packageCalendarBookingValidator),
		details: packageCalendarDetailsValidator
	},
	handler: (_ctx, args) => savePackageSessionCalendarEvent(args)
});

export const updatePackageSessionCalendarEvent = internalAction({
	args: { session: packageCalendarBookingValidator, details: packageCalendarDetailsValidator },
	handler: (_ctx, args) => savePackageSessionCalendarEvent(args)
});

type DeletePackageSessionCalendarEventArgs = { session: SessionCalendarEventRecord };

export const deletePackageSessionCalendarEvent = internalAction({
	args: { session: packageCalendarBookingValidator },
	handler: (ctx, args) => deletePackageSessionCalendarEventHandler(ctx, args)
});

async function deletePackageSessionCalendarEventHandler(
	_ctx: ActionCtx,
	args: DeletePackageSessionCalendarEventArgs
) {
	try {
		const { calendar, calendarId, timeZone } = getGoogleCalendarClient();
		const [deleteError, deleteResult] = await deleteSessionCalendarEvent({
			session: args.session,
			client: { calendar, calendarId, timeZone }
		});

		if (deleteError?.reason === "GOOGLE_CALENDAR_AUTH_FAILED") {
			return err({ reason: "GOOGLE_CALENDAR_AUTH_FAILED" });
		}

		if (deleteError?.reason === "GOOGLE_CALENDAR_RATE_LIMITED") {
			return err({ reason: "GOOGLE_CALENDAR_RATE_LIMITED" });
		}

		if (deleteError !== null) {
			return err({ reason: "GOOGLE_CALENDAR_SYNC_FAILED" });
		}

		return ok(deleteResult);
	} catch (error) {
		return err({ reason: getGoogleCalendarErrorCode(error, "GOOGLE_CALENDAR_SYNC_FAILED") });
	}
}
