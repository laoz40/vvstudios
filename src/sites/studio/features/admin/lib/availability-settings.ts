import { DEFAULT_BOOKING_AVAILABILITY_SETTINGS } from "#studio/lib/bookingdatetime";

export const bookingDayLabels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export const bookingTimeOptions = Array.from({ length: 48 }, (_, index) => {
	const hours = String(Math.floor(index / 2)).padStart(2, "0");
	const minutes = index % 2 === 0 ? "00" : "30";
	return `${hours}:${minutes}`;
});

export type BookingSettings = typeof DEFAULT_BOOKING_AVAILABILITY_SETTINGS;
export type NumberSettingKey = "eventBufferMinutes" | "leadTimeMinutes" | "maxDaysAhead";

export function toBookingSettingsDraft(settings: BookingSettings): BookingSettings {
	return {
		eventBufferMinutes: settings.eventBufferMinutes,
		leadTimeMinutes: settings.leadTimeMinutes,
		maxDaysAhead: settings.maxDaysAhead,
		weekSchedule: settings.weekSchedule.map((schedule) => ({
			endTime: schedule.endTime,
			startTime: schedule.startTime,
		})),
	};
}

export function parseNumberSetting(value: string) {
	return Number(value) || 0;
}

export function hoursToMinutes(value: string) {
	return parseNumberSetting(value) * 60;
}
