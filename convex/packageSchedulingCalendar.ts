"use node";

import { v } from "convex/values";
import { err, ok, type Result } from "../src/lib/result";
import { internal } from "./_generated/api";
import { action, type ActionCtx } from "./_generated/server";
import { formatDateValue, startOfToday } from "../src/sites/studio/lib/bookingdatetime";
import { getGoogleCalendarClient } from "./lib/googleCalendarClient";
import {
	getDateAvailabilityRange,
	groupBusyDaysByMonth,
	groupBusyWindowsByDay
} from "./lib/bookingCalendarTime";
import type { BusyDayWindow } from "./lib/bookingCalendarTime";
import { getBusyWindowsInRange } from "./lib/googleCalendarAvailability";
import { checkGoogleCalendarAvailabilityRateLimit } from "./lib/rateLimits";
import { getGoogleCalendarErrorCode } from "./lib/googleCalendarErrors";
import type { ValidPackage, ValidPackageByTokenError } from "./packageScheduling";

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
