import { err, ok } from "neverthrow";
import type { QueryCtx } from "#convex/_generated/server";
import {
	DEFAULT_BOOKING_AVAILABILITY_SETTINGS,
	type BookingAvailabilitySettings
} from "#studio/lib/bookingAvailabilitySettings";
import { parseScheduleTime, scheduleTimeStringSchema } from "#studio/lib/calendarDate";
import { okOrThrow } from "#convex/lib/result";

export function getBookingAvailabilitySettings(ctx: QueryCtx) {
	return okOrThrow(
		ctx.db
			.query("bookingSettings")
			.withIndex("by_key", (query) => query.eq("key", "main"))
			.unique()
			.then((settings) => settings ?? DEFAULT_BOOKING_AVAILABILITY_SETTINGS)
	);
}

function getTimeMinutes(value: string) {
	const timeOfDay = parseScheduleTime(value);

	if (!timeOfDay) {
		return null;
	}

	return timeOfDay.hours * 60 + timeOfDay.minutes;
}

function isValidScheduleWindow(startTime: string, endTime: string) {
	if (!scheduleTimeStringSchema.safeParse(startTime).success) {
		return false;
	}

	if (!scheduleTimeStringSchema.safeParse(endTime).success) {
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

export function validateBookingSettings(settings: BookingAvailabilitySettings) {
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
