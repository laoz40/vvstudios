export {
	BOOKING_EVENT_BUFFER_MINUTES,
	BOOKING_LEAD_TIME_MINUTES,
	BOOKING_MAX_DAYS_AHEAD,
	DEFAULT_BOOKING_AVAILABILITY_SETTINGS,
	DEFAULT_BOOKING_END_TIME,
	DEFAULT_BOOKING_START_TIME,
	DEFAULT_BOOKING_WEEK_SCHEDULE,
	type BookingAvailabilitySettings,
	type BookingDaySchedule,
} from "#studio/lib/bookingAvailabilitySettings";
import {
	BOOKING_EVENT_BUFFER_MINUTES,
	BOOKING_MAX_DAYS_AHEAD,
	DEFAULT_BOOKING_AVAILABILITY_SETTINGS,
	DEFAULT_BOOKING_END_TIME,
	DEFAULT_BOOKING_START_TIME,
	type BookingAvailabilitySettings,
} from "#studio/lib/bookingAvailabilitySettings";

const BOOKING_TIME_ZONE = "Australia/Sydney";

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
	eventBufferMinutes = BOOKING_EVENT_BUFFER_MINUTES,
	endTime = DEFAULT_BOOKING_END_TIME,
	startTime = DEFAULT_BOOKING_START_TIME,
}: {
	busyPeriods: BusyPeriod[];
	duration: string;
	eventBufferMinutes?: number;
	endTime?: string;
	startTime?: string;
}) {
	const durationMinutes = getDurationMinutes(duration);
	const dayStartMinutes = parseTimeToMinutes(startTime);
	const dayEndMinutes = parseTimeToMinutes(endTime);
	const busyRanges = busyPeriods.map((period) => ({
		endMinutes: Math.min(24 * 60, parseReadableTimeToMinutes(period.end) + eventBufferMinutes),
		startMinutes: Math.max(0, parseReadableTimeToMinutes(period.start) - eventBufferMinutes),
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

export function formatBookingDate(dateValue: string) {
	const date = parseDateValue(dateValue);
	if (!date) {
		return dateValue;
	}

	return new Intl.DateTimeFormat("en-AU", {
		dateStyle: "full",
	}).format(date);
}

export function formatBookingDateSummary(dateValue: string) {
	const date = parseDateValue(dateValue);
	if (!date) {
		return dateValue;
	}

	return new Intl.DateTimeFormat("en-AU", {
		day: "numeric",
		month: "long",
		weekday: "short",
		year: "numeric",
	}).format(date);
}

const bookingSydneyDateTimeFormatter = new Intl.DateTimeFormat("en-AU", {
	dateStyle: "medium",
	timeStyle: "short",
	timeZone: "Australia/Sydney",
});

const bookingSydneyDateFormatter = new Intl.DateTimeFormat("en-AU", {
	dateStyle: "medium",
	timeZone: "Australia/Sydney",
});

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

export function getLastBookableDate(today = startOfToday(), maxDaysAhead = BOOKING_MAX_DAYS_AHEAD) {
	return addDays(today, maxDaysAhead);
}

export function getCurrentTimestamp() {
	return Date.now();
}

export function getAvailableTimesForDate({
	busyPeriods,
	currentTimestamp,
	dateValue,
	duration,
	settings = DEFAULT_BOOKING_AVAILABILITY_SETTINGS,
}: {
	busyPeriods: BusyPeriod[];
	currentTimestamp: number;
	dateValue: string;
	duration: string;
	settings?: BookingAvailabilitySettings;
}) {
	const bookingDate = parseDateValue(dateValue);
	if (!bookingDate) {
		return [];
	}

	const daySchedule = settings.weekSchedule[bookingDate.getDay()];
	if (!daySchedule) {
		return [];
	}

	const availableTimes = getAvailableTimesForBusyPeriods({
		busyPeriods,
		duration,
		eventBufferMinutes: settings.eventBufferMinutes,
		endTime: daySchedule.endTime,
		startTime: daySchedule.startTime,
	});
	const earliestStartTimestamp = currentTimestamp + settings.leadTimeMinutes * 60 * 1000;

	return availableTimes.filter((time) => {
		const bookingStart = parseDateTimeValue(dateValue, time);
		return bookingStart !== null && bookingStart.getTime() >= earliestStartTimestamp;
	});
}

export function formatTimeValue(time: string) {
	const [hours, minutes] = time.split(":").map(Number);

	if (Number.isNaN(hours) || Number.isNaN(minutes)) {
		return time;
	}

	return new Intl.DateTimeFormat("en-AU", {
		hour: "numeric",
		hour12: true,
		minute: "2-digit",
	})
		.format(new Date(2000, 0, 1, hours, minutes))
		.replace(/\s?(am|pm)$/i, "$1");
}

export function formatBookingTimestamp(timestamp: number) {
	return bookingSydneyDateTimeFormatter.format(timestamp);
}

export function formatBookingDateMedium(dateValue: string) {
	const date = parseDateValue(dateValue);
	if (!date) {
		return dateValue;
	}

	return bookingSydneyDateFormatter.format(date);
}

export function formatBookingTimeLabel(timeValue: string | undefined) {
	if (!timeValue) {
		return "Time TBD";
	}

	return formatTimeValue(timeValue).replace(/(am|pm)$/i, " $1");
}

export function formatBookingTimeRange(timeValue: string, duration: string) {
	const startMinutes = parseTimeToMinutes(timeValue);
	const endMinutes = startMinutes + getDurationMinutes(duration);

	return `${formatTimeValue(timeValue)} – ${formatTimeValue(formatMinutesToTime(endMinutes))}`;
}

export function getBookingStartTimestamp(dateValue: string, timeValue: string) {
	const utcDate = getUtcDateForZonedDateTime(dateValue, timeValue, BOOKING_TIME_ZONE);
	if (!utcDate) {
		return 0;
	}

	return utcDate.getTime();
}

export function isUpcomingBooking(dateValue: string, timeValue: string, now = Date.now()) {
	return getBookingStartTimestamp(dateValue, timeValue) >= now;
}

export function getStartOfWeekTimestamp(now = new Date()) {
	const startOfWeek = new Date(now);
	const dayOfWeek = startOfWeek.getDay();
	const daysSinceMonday = (dayOfWeek + 6) % 7;

	startOfWeek.setHours(0, 0, 0, 0);
	startOfWeek.setDate(startOfWeek.getDate() - daysSinceMonday);

	return startOfWeek.getTime();
}

export function getFirstName(name: string) {
	return name.trim().split(/\s+/)[0] || name;
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

function formatMinutesToTime(totalMinutes: number) {
	const normalizedMinutes = totalMinutes % (24 * 60);
	const hours = Math.floor(normalizedMinutes / 60);
	const minutes = normalizedMinutes % 60;

	return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

function getDurationMinutes(duration: string) {
	if (duration === "1h") return 60;
	if (duration === "2h") return 120;
	if (duration === "3h") return 180;
	return 60;
}

function getUtcDateForZonedDateTime(dateValue: string, timeValue: string, timeZone: string) {
	const date = parseDateValue(dateValue);
	if (!date) {
		return null;
	}

	const [hours, minutes] = timeValue.split(":").map(Number);
	const targetUtcMs = Date.UTC(
		date.getFullYear(),
		date.getMonth(),
		date.getDate(),
		hours,
		minutes,
		0,
		0,
	);

	let guessUtcMs = targetUtcMs;

	for (let iteration = 0; iteration < 3; iteration += 1) {
		const zonedParts = getTimeZoneParts(new Date(guessUtcMs), timeZone);
		const currentUtcMs = Date.UTC(
			zonedParts.year,
			zonedParts.month - 1,
			zonedParts.day,
			zonedParts.hours,
			zonedParts.minutes,
			0,
			0,
		);
		const diffMs = targetUtcMs - currentUtcMs;

		guessUtcMs += diffMs;

		if (diffMs === 0) {
			break;
		}
	}

	return new Date(guessUtcMs);
}

const timeZoneFormatterCache = new Map<string, Intl.DateTimeFormat>();

function getTimeZoneFormatter(timeZone: string) {
	const cachedFormatter = timeZoneFormatterCache.get(timeZone);

	if (cachedFormatter) {
		return cachedFormatter;
	}

	const formatter = new Intl.DateTimeFormat("en-CA", {
		day: "2-digit",
		hour: "2-digit",
		hour12: false,
		hourCycle: "h23",
		minute: "2-digit",
		month: "2-digit",
		second: "2-digit",
		timeZone,
		year: "numeric",
	});

	timeZoneFormatterCache.set(timeZone, formatter);

	return formatter;
}

function getTimeZoneParts(date: Date, timeZone: string) {
	const parts = getTimeZoneFormatter(timeZone).formatToParts(date);
	const values = Object.fromEntries(
		parts.filter((part) => part.type !== "literal").map((part) => [part.type, Number(part.value)]),
	) as Record<"day" | "hour" | "minute" | "month" | "second" | "year", number>;

	return {
		day: values.day,
		hours: values.hour === 24 ? 0 : values.hour,
		minutes: values.minute,
		month: values.month,
		year: values.year,
	};
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
