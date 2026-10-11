import {
	getAvailableTimeOptions,
	groupBusyDaysByMonth,
	groupBusyWindowsByDay,
	type SessionAvailabilitySettings
} from "#convex/sessions/lib/calendarTime";
import {
	getBusyWindows,
	getBusyWindowsInRange
} from "#convex/googleCalendar/lib/googleCalendarAvailability";
import { formatDateValue, getLastBookableDate, startOfToday } from "#studio/lib/bookingdatetime";

export type IgnoredBusyEvent = { calendarId?: string; eventId?: string };

export function bookableRangeBusyWindowsForTimeZone(
	timeZone: string,
	busyWindows: Awaited<ReturnType<typeof getBusyWindowsInRange>>
) {
	return groupBusyWindowsByDay(busyWindows, timeZone).map((busyDays) => ({
		busyWindowsByMonth: groupBusyDaysByMonth(busyDays),
		timeZone
	}));
}

export function bookableRangeDateArgs(settings: SessionAvailabilitySettings) {
	const today = startOfToday();

	return {
		startDate: formatDateValue(today),
		endDate: formatDateValue(getLastBookableDate(today, settings.maxDaysAhead))
	};
}

export function dayAvailableBookingTimes(
	args: { date: string; duration: string; settings: SessionAvailabilitySettings; timeZone: string },
	busyWindows: Awaited<ReturnType<typeof getBusyWindows>>
) {
	return {
		timeZone: args.timeZone,
		times: getAvailableTimeOptions({
			busyWindows,
			date: args.date,
			duration: args.duration,
			eventBufferMinutes: args.settings.eventBufferMinutes,
			timeZone: args.timeZone
		})
	};
}
