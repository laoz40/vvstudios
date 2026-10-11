"use node";

import { ResultAsync } from "neverthrow";
import type { ActionCtx } from "#convex/_generated/server";
import { loadPackageByToken } from "#convex/googleCalendar/lib/packageAvailability";
import {
	groupedPackageBusyWindows,
	packageAvailabilityDates,
	type PackageAvailabilityContext
} from "#convex/googleCalendar/lib/packageAvailability";
import { getBusyWindowsInRange } from "#convex/googleCalendar/lib/googleCalendarAvailability";
import { loadGoogleCalendarClient } from "#convex/googleCalendar/lib/googleCalendarClient";
import { tryGoogleCalendarAvailability } from "#convex/googleCalendar/lib/googleCalendarErrors";
import { checkGoogleCalendarAvailabilityRateLimit } from "#convex/shared/services/rateLimits";
import type { ValidPackageByTokenError } from "#convex/packages/lib/scheduling";
import type { BusyDayWindow as LibBusyDayWindow } from "#convex/sessions/lib/calendarTime";
import { getDateAvailabilityRange } from "#convex/googleCalendar/services/calendarTime";
import { groupBusyWindowsByDay } from "#convex/sessions/lib/calendarTime";

export type BusyDayWindow = LibBusyDayWindow;

export type PackageAvailabilityError =
	| ValidPackageByTokenError
	| {
			reason:
				| "BOOKING_INVALID_DATE"
				| "BOOKING_INVALID_TIME"
				| "GOOGLE_CALENDAR_AVAILABILITY_FAILED"
				| "GOOGLE_CALENDAR_AUTH_FAILED"
				| "GOOGLE_CALENDAR_RATE_LIMITED"
				| "INVALID_ZONED_TIME";
	  };

export function loadValidPackageForCalendarAvailability(
	ctx: ActionCtx,
	args: { rateLimitKey: string; token: string }
): ResultAsync<PackageAvailabilityContext, PackageAvailabilityError> {
	return loadPackageByToken(ctx, args.token)
		.andThen((packageFromDb: PackageAvailabilityContext["packageFromDb"]) =>
			checkGoogleCalendarAvailabilityRateLimit(ctx, args.rateLimitKey).map(() => packageFromDb)
		)
		.andThen((packageFromDb) =>
			loadGoogleCalendarClient("GOOGLE_CALENDAR_AVAILABILITY_FAILED").map(
				(client: PackageAvailabilityContext["client"]) => ({ client, packageFromDb })
			)
		)
		.andThen(({ client, packageFromDb }) => {
			const { startDate, endDate } = packageAvailabilityDates(packageFromDb);

			return getDateAvailabilityRange(startDate, endDate, client.timeZone).map(
				(availabilityRange: PackageAvailabilityContext["availabilityRange"]) => ({
					availabilityRange,
					client,
					packageFromDb
				})
			);
		});
}

export function loadPackageBookableRangeBusyWindows(
	context: PackageAvailabilityContext
): ResultAsync<
	PackageAvailabilityContext & { busyWindows: Awaited<ReturnType<typeof getBusyWindowsInRange>> },
	PackageAvailabilityError
> {
	return tryGoogleCalendarAvailability(() =>
		getBusyWindowsInRange({
			calendar: context.client.calendar,
			calendarIds: context.client.calendarIds,
			timeMax: context.availabilityRange.timeMax,
			timeMin: context.availabilityRange.timeMin,
			timeZone: context.client.timeZone
		})
	).map((busyWindows: Awaited<ReturnType<typeof getBusyWindowsInRange>>) => ({
		...context,
		busyWindows
	}));
}

export function groupPackageBusyWindowsByMonth(context: {
	busyWindows: Awaited<ReturnType<typeof getBusyWindowsInRange>>;
	client: { timeZone: string };
	packageFromDb: { expiresAt: number };
}) {
	return groupBusyWindowsByDay(context.busyWindows, context.client.timeZone).map(
		(busyDays: BusyDayWindow[]) => groupedPackageBusyWindows(context, busyDays)
	);
}
