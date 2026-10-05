"use node";

import { ResultAsync } from "neverthrow";
import { internal } from "#convex/_generated/api";
import type { ActionCtx } from "#convex/_generated/server";
import { getBusyWindowsInRange } from "#convex/lib/googleCalendar/googleCalendarAvailability";
import { loadGoogleCalendarClient } from "#convex/lib/googleCalendar/googleCalendarClient";
import { tryGoogleCalendarAvailability } from "#convex/lib/googleCalendar/googleCalendarErrors";
import { fromConvexTuple } from "#convex/lib/result";
import type { ValidPackageByTokenError } from "#convex/lib/packages/packageScheduling";
import { checkGoogleCalendarAvailabilityRateLimit } from "#convex/lib/rateLimits";
import {
	groupBusyDaysByMonth,
	groupBusyWindowsByDay,
	type BusyDayWindow as LibBusyDayWindow
} from "#convex/lib/sessions/sessionCalendarTime";
import { getDateAvailabilityRange } from "#convex/services/googleCalendar/sessionCalendarTime";
import { formatDateValue, startOfToday } from "#studio/lib/bookingdatetime";

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

type PackageAvailabilityContext = {
	availabilityRange: { timeMax: string; timeMin: string };
	client: {
		calendar: Parameters<typeof getBusyWindowsInRange>[0]["calendar"];
		calendarIds: string[];
		timeZone: string;
	};
	packageFromDb: { expiresAt: number };
};

function retainValueStep<T>(value: T) {
	return value;
}

function packageFromDbAfterRateLimitStep(
	ctx: ActionCtx,
	rateLimitKey: string,
	packageFromDb: PackageAvailabilityContext["packageFromDb"]
) {
	return checkGoogleCalendarAvailabilityRateLimit(ctx, rateLimitKey).map(() =>
		retainValueStep(packageFromDb)
	);
}

function pairPackageWithCalendarClient(
	packageFromDb: PackageAvailabilityContext["packageFromDb"],
	client: PackageAvailabilityContext["client"]
) {
	return { client, packageFromDb };
}

function loadPackageCalendarClientForPackageStep(
	packageFromDb: PackageAvailabilityContext["packageFromDb"]
) {
	return loadGoogleCalendarClient("GOOGLE_CALENDAR_AVAILABILITY_FAILED").map(
		(client: PackageAvailabilityContext["client"]) =>
			pairPackageWithCalendarClient(packageFromDb, client)
	);
}

function packageAvailabilityContextStep({
	client,
	packageFromDb
}: {
	client: PackageAvailabilityContext["client"];
	packageFromDb: PackageAvailabilityContext["packageFromDb"];
}) {
	const startDate = formatDateValue(startOfToday());
	const endDate = formatDateValue(new Date(packageFromDb.expiresAt));

	return getDateAvailabilityRange(startDate, endDate, client.timeZone).map(
		(availabilityRange: PackageAvailabilityContext["availabilityRange"]) =>
			packageAvailabilityRangeStep(client, packageFromDb, availabilityRange)
	);
}

function packageAvailabilityRangeStep(
	client: PackageAvailabilityContext["client"],
	packageFromDb: PackageAvailabilityContext["packageFromDb"],
	availabilityRange: PackageAvailabilityContext["availabilityRange"]
) {
	return { availabilityRange, client, packageFromDb };
}

export function loadValidPackageForCalendarAvailability(
	ctx: ActionCtx,
	args: { rateLimitKey: string; token: string }
): ResultAsync<PackageAvailabilityContext, PackageAvailabilityError> {
	return fromConvexTuple(
		ctx.runQuery(internal.packageScheduling.getValidPackageByToken, {
			now: Date.now(),
			token: args.token
		})
	)
		.andThen((packageFromDb: PackageAvailabilityContext["packageFromDb"]) =>
			packageFromDbAfterRateLimitStep(ctx, args.rateLimitKey, packageFromDb)
		)
		.andThen(loadPackageCalendarClientForPackageStep)
		.andThen(packageAvailabilityContextStep);
}

function packageBusyWindowsContextStep(
	context: PackageAvailabilityContext,
	busyWindows: Awaited<ReturnType<typeof getBusyWindowsInRange>>
) {
	return { ...context, busyWindows };
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
	).map((busyWindows: Awaited<ReturnType<typeof getBusyWindowsInRange>>) =>
		packageBusyWindowsContextStep(context, busyWindows)
	);
}

function groupedPackageBusyWindowsStep(
	context: {
		busyWindows: Awaited<ReturnType<typeof getBusyWindowsInRange>>;
		client: { timeZone: string };
		packageFromDb: { expiresAt: number };
	},
	busyDays: BusyDayWindow[]
) {
	return {
		busyWindowsByMonth: groupBusyDaysByMonth(busyDays),
		packageExpiresAt: context.packageFromDb.expiresAt,
		timeZone: context.client.timeZone
	};
}

export function groupPackageBusyWindowsByMonth(context: {
	busyWindows: Awaited<ReturnType<typeof getBusyWindowsInRange>>;
	client: { timeZone: string };
	packageFromDb: { expiresAt: number };
}) {
	return groupBusyWindowsByDay(context.busyWindows, context.client.timeZone).map(
		(busyDays: BusyDayWindow[]) => groupedPackageBusyWindowsStep(context, busyDays)
	);
}
