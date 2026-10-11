import { internal } from "#convex/_generated/api";
import type { ActionCtx } from "#convex/_generated/server";
import { fromConvexTuple } from "#convex/shared/lib/result";
import { getBusyWindowsInRange } from "#convex/googleCalendar/lib/googleCalendarAvailability";
import { groupBusyDaysByMonth, type BusyDayWindow } from "#convex/sessions/lib/calendarTime";
import { formatDateValue, startOfToday } from "#studio/lib/bookingdatetime";

export type PackageAvailabilityContext = {
	availabilityRange: { timeMax: string; timeMin: string };
	client: {
		calendar: Parameters<typeof getBusyWindowsInRange>[0]["calendar"];
		calendarIds: string[];
		timeZone: string;
	};
	packageFromDb: { expiresAt: number };
};

export function loadPackageByToken(ctx: ActionCtx, token: string) {
	return fromConvexTuple(
		ctx.runQuery(internal.packages.scheduling.getValidPackageByToken, { now: Date.now(), token })
	);
}

export function packageAvailabilityDates(packageFromDb: { expiresAt: number }) {
	return {
		startDate: formatDateValue(startOfToday()),
		endDate: formatDateValue(new Date(packageFromDb.expiresAt))
	};
}

export function groupedPackageBusyWindows(
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
