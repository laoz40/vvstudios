import type { BookingAvailabilitySettings } from "../../src/sites/studio/lib/bookingAvailabilitySettings";

function isValidTime(value: string) {
	return /^([01]\d|2[0-3]):(00|30)$/.test(value);
}

function getTimeMinutes(value: string) {
	const [hours, minutes] = value.split(":").map(Number);

	if (!Number.isFinite(hours) || !Number.isFinite(minutes)) {
		return null;
	}

	return hours * 60 + minutes;
}

function isValidScheduleWindow(startTime: string, endTime: string) {
	if (!isValidTime(startTime) || !isValidTime(endTime)) {
		return false;
	}

	// Treat 00:00 to 00:00 as a closed day instead of a zero-length opening.
	if (startTime === "00:00" && endTime === "00:00") {
		return true;
	}

	const startMinutes = getTimeMinutes(startTime);
	const endMinutes = getTimeMinutes(endTime);

	return startMinutes !== null && endMinutes !== null && startMinutes < endMinutes;
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
		if (!isValidScheduleWindow(schedule.startTime, schedule.endTime)) {
			return false;
		}
	}

	return true;
}
