import { err, ok } from "neverthrow";
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

export function validateBookingSettingsResult(settings: BookingAvailabilitySettings) {
	if (
		settings.weekSchedule.length !== 7 ||
		settings.leadTimeMinutes < 0 ||
		settings.eventBufferMinutes < 0 ||
		settings.maxDaysAhead < 1
	) {
		return err({ reason: "INVALID_BOOKING_SETTINGS" as const });
	}

	for (const schedule of Object.values(settings.weekSchedule)) {
		if (!isValidScheduleWindow(schedule.startTime, schedule.endTime)) {
			return err({ reason: "INVALID_BOOKING_SETTINGS" as const });
		}
	}

	return ok(settings);
}
