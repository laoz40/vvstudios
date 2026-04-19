export const DEFAULT_BOOKING_START_TIME = "08:00";
export const DEFAULT_BOOKING_END_TIME = "22:00";
export const BOOKING_LEAD_TIME_MINUTES = 12 * 60;
export const BOOKING_MAX_DAYS_AHEAD = 60;

export interface BookingDaySchedule {
	endTime: string;
	startTime: string;
}

export const DEFAULT_BOOKING_WEEK_SCHEDULE: Record<number, BookingDaySchedule> = {
	0: { startTime: "10:00", endTime: "21:00" }, // Sunday
	1: { startTime: DEFAULT_BOOKING_START_TIME, endTime: DEFAULT_BOOKING_END_TIME },
	2: { startTime: DEFAULT_BOOKING_START_TIME, endTime: DEFAULT_BOOKING_END_TIME },
	3: { startTime: DEFAULT_BOOKING_START_TIME, endTime: DEFAULT_BOOKING_END_TIME },
	4: { startTime: DEFAULT_BOOKING_START_TIME, endTime: DEFAULT_BOOKING_END_TIME },
	5: { startTime: DEFAULT_BOOKING_START_TIME, endTime: DEFAULT_BOOKING_END_TIME },
	6: { startTime: DEFAULT_BOOKING_START_TIME, endTime: "21:00" },
};

const TIME_OPTIONS = Array.from({ length: 48 }, (_, index) => {
	const hours = String(Math.floor(index / 2)).padStart(2, "0");
	const minutes = index % 2 === 0 ? "00" : "30";

	return `${hours}:${minutes}`;
});

export interface BusyPeriod {
	end: string;
	start: string;
}

export function getCurrentMonthKey() {
	const today = new Date();
	return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;
}

export function getAvailableTimesForBusyPeriods({
	busyPeriods,
	duration,
	endTime = DEFAULT_BOOKING_END_TIME,
	startTime = DEFAULT_BOOKING_START_TIME,
}: {
	busyPeriods: BusyPeriod[];
	duration: string;
	endTime?: string;
	startTime?: string;
}) {
	const durationMinutes = getDurationMinutes(duration);
	const dayStartMinutes = parseTimeToMinutes(startTime);
	const dayEndMinutes = parseTimeToMinutes(endTime);
	const busyRanges = busyPeriods.map((period) => ({
		endMinutes: parseReadableTimeToMinutes(period.end),
		startMinutes: parseReadableTimeToMinutes(period.start),
	}));

	return TIME_OPTIONS.filter((time) => {
		const startMinutes = parseTimeToMinutes(time);
		const endMinutes = startMinutes + durationMinutes;

		if (startMinutes < dayStartMinutes || endMinutes > dayEndMinutes) {
			return false;
		}

		return !busyRanges.some((busyRange) => {
			return startMinutes < busyRange.endMinutes && endMinutes > busyRange.startMinutes;
		});
	});
}

export function hasAvailableTimesForBusyPeriods({
	busyPeriods,
	duration,
}: {
	busyPeriods: BusyPeriod[];
	duration: string;
}) {
	return getAvailableTimesForBusyPeriods({ busyPeriods, duration }).length > 0;
}

export function formatMonthKey(date: Date) {
	return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

export function parseMonthKey(monthKey: string) {
	const [year, month] = monthKey.split("-").map(Number);

	return new Date(year, month - 1, 1);
}

export function formatMonthName(date: Date) {
	return date.toLocaleString("default", { month: "long" });
}

export function formatDateValue(date: Date) {
	return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
		date.getDate(),
	).padStart(2, "0")}`;
}

export function parseDateValue(value: string) {
	if (!value) {
		return undefined;
	}

	const [year, month, day] = value.split("-").map(Number);
	if (!year || !month || !day) {
		return undefined;
	}

	return new Date(year, month - 1, day);
}

export function startOfMonth(date: Date) {
	return new Date(date.getFullYear(), date.getMonth(), 1);
}

export function startOfToday() {
	const today = new Date();
	return new Date(today.getFullYear(), today.getMonth(), today.getDate());
}

export function addDays(date: Date, days: number) {
	const result = new Date(date);
	result.setDate(result.getDate() + days);
	return result;
}

export function getLastBookableDate(today = startOfToday()) {
	return addDays(today, BOOKING_MAX_DAYS_AHEAD);
}

export function getCurrentTimestamp() {
	return Date.now();
}

export function getAvailableTimesForDate({
	busyPeriods,
	currentTimestamp,
	dateValue,
	duration,
	weekSchedule = DEFAULT_BOOKING_WEEK_SCHEDULE,
}: {
	busyPeriods: BusyPeriod[];
	currentTimestamp: number;
	dateValue: string;
	duration: string;
	weekSchedule?: Record<number, BookingDaySchedule>;
}) {
	const bookingDate = parseDateValue(dateValue);
	if (!bookingDate) {
		return [];
	}

	const daySchedule = weekSchedule[bookingDate.getDay()];
	if (!daySchedule) {
		return [];
	}

	const availableTimes = getAvailableTimesForBusyPeriods({
		busyPeriods,
		duration,
		endTime: daySchedule.endTime,
		startTime: daySchedule.startTime,
	});
	const earliestStartTimestamp = currentTimestamp + BOOKING_LEAD_TIME_MINUTES * 60 * 1000;

	return availableTimes.filter((time) => {
		const bookingStart = parseDateTimeValue(dateValue, time);
		return bookingStart !== null && bookingStart.getTime() >= earliestStartTimestamp;
	});
}

export function toOptionId(value: string) {
	return value.toLowerCase().replaceAll(/[^a-z0-9]+/g, "-");
}

function parseDateTimeValue(dateValue: string, timeValue: string) {
	const date = parseDateValue(dateValue);
	if (!date) {
		return null;
	}

	const [hours, minutes] = timeValue.split(":").map(Number);
	date.setHours(hours, minutes, 0, 0);
	return date;
}

function parseTimeToMinutes(time: string) {
	const [hours, minutes] = time.split(":").map(Number);
	return hours * 60 + minutes;
}

function getDurationMinutes(duration: string) {
	if (duration === "1h") return 60;
	if (duration === "2h") return 120;
	if (duration === "3h") return 180;
	return 60;
}

function parseReadableTimeToMinutes(time: string) {
	const match = time.trim().match(/^(\d{1,2}):(\d{2})\s([AP]M)$/i);
	if (!match) {
		return 0;
	}

	const hours = Number(match[1]);
	const minutes = Number(match[2]);
	const meridiem = match[3].toUpperCase();
	const normalizedHours = (hours % 12) + (meridiem === "PM" ? 12 : 0);

	return normalizedHours * 60 + minutes;
}
