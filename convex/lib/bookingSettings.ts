import type { BookingAvailabilitySettings } from "../../src/sites/studio/lib/bookingAvailabilitySettings";

function isValidTime(value: string) {
	return /^([01]\d|2[0-3]):(00|30)$/.test(value);
}

export function isValidBookingSettings(args: BookingAvailabilitySettings) {
	if (
		args.weekSchedule.length !== 7 ||
		args.leadTimeMinutes < 0 ||
		args.eventBufferMinutes < 0 ||
		args.maxDaysAhead < 1
	) {
		return false;
	}

	for (const schedule of Object.values(args.weekSchedule)) {
		if (!isValidTime(schedule.startTime) || !isValidTime(schedule.endTime)) {
			return false;
		}
	}

	return true;
}
