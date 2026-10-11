import type { BookingAvailabilitySettings } from "#studio/lib/bookingAvailabilitySettings";
import { getAvailableTimeOptions, type BusyWindow } from "#convex/sessions/lib/calendarTime";

export function availableRescheduleTimesForDay(
	args: { date: string },
	details: { session: { duration: string } },
	settings: BookingAvailabilitySettings,
	{ busyWindows, timeZone }: { busyWindows: BusyWindow[]; timeZone: string },
	validateAvailability: (args: {
		date: string;
		duration: string;
		now: number;
		settings: BookingAvailabilitySettings;
		time: string;
		timeZone: string;
	}) => { isOk(): boolean }
) {
	const calendarAvailableTimes = getAvailableTimeOptions({
		busyWindows,
		date: args.date,
		duration: details.session.duration,
		eventBufferMinutes: settings.eventBufferMinutes,
		timeZone
	});

	const now = Date.now();

	const times = calendarAvailableTimes.filter((time) =>
		validateAvailability({
			date: args.date,
			duration: details.session.duration,
			now,
			settings,
			time,
			timeZone
		}).isOk()
	);

	return { timeZone, times };
}
