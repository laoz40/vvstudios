export {
	DEFAULT_BOOKING_AVAILABILITY_SETTINGS,
	BOOKING_TIME_OPTIONS,
	type BookingAvailabilitySettings,
} from "#studio/lib/bookingAvailabilitySettings";

import {
	BOOKING_EVENT_BUFFER_MINUTES,
	BOOKING_MAX_DAYS_AHEAD,
	BOOKING_TIME_OPTIONS,
	DEFAULT_BOOKING_AVAILABILITY_SETTINGS,
	DEFAULT_BOOKING_END_TIME,
	DEFAULT_BOOKING_START_TIME,
	type BookingAvailabilitySettings,
} from "#studio/lib/bookingAvailabilitySettings";
import { getUtcDateForZonedParts } from "#studio/lib/zonedDateTime";

const BOOKING_TIME_ZONE = "Australia/Sydney";

export interface BusyPeriod {
	end: string;
	start: string;
}

export function getCurrentMonthKey() {
	const today = new Date();
	return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;
}

function getAvailableTimesForBusyPeriods({
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

	return BOOKING_TIME_OPTIONS.filter((time) => {
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

export function formatMonthKey(date: Date) {
	return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

export function parseMonthKey(monthKey: string) {
	const [year, month] = monthKey.split("-").map(Number);

	return new Date(year, month - 1, 1);
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

export function formatBookingDateDots(dateValue: string) {
	const date = parseDateValue(dateValue);
	if (!date) {
		return "";
	}

	return new Intl.DateTimeFormat("en-AU", {
		day: "2-digit",
		month: "2-digit",
		year: "numeric",
	})
		.format(date)
		.replaceAll("/", ".");
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

function getDatePartsInSydney(date: Date) {
	const parts = new Intl.DateTimeFormat("en-AU", {
		day: "2-digit",
		month: "2-digit",
		timeZone: BOOKING_TIME_ZONE,
		year: "numeric",
	}).formatToParts(date);

	const partValue = (type: string) => parts.find((part) => part.type === type)?.value;

	return {
		day: Number(partValue("day")),
		month: Number(partValue("month")),
		year: Number(partValue("year")),
	};
}

function getSydneyDateValue(date = new Date()) {
	const { day, month, year } = getDatePartsInSydney(date);

	return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function getDateUtcTimestamp(dateValue: string) {
	const date = parseDateValue(dateValue);
	if (!date) {
		return null;
	}

	return Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
}

function formatRelativeDateDistance(dayDifference: number) {
	const absoluteDays = Math.abs(dayDifference);

	if (absoluteDays < 30) {
		return `${absoluteDays} ${absoluteDays === 1 ? "day" : "days"}`;
	}

	if (absoluteDays < 365) {
		const months = Math.max(1, Math.round(absoluteDays / 30));
		return `${months} ${months === 1 ? "month" : "months"}`;
	}

	const years = Math.max(1, Math.round(absoluteDays / 365));
	return `${years} ${years === 1 ? "year" : "years"}`;
}

export function startOfMonth(date: Date) {
	return new Date(date.getFullYear(), date.getMonth(), 1);
}

export function startOfToday() {
	const today = new Date();
	return new Date(today.getFullYear(), today.getMonth(), today.getDate());
}

function addDays(date: Date, days: number) {
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

export function formatBookingRelativeDate(dateValue: string, now = new Date()) {
	const bookingTimestamp = getDateUtcTimestamp(dateValue);
	const todayTimestamp = getDateUtcTimestamp(getSydneyDateValue(now));

	if (bookingTimestamp === null || todayTimestamp === null) {
		return dateValue;
	}

	const dayDifference = Math.round((bookingTimestamp - todayTimestamp) / (24 * 60 * 60 * 1000));

	if (dayDifference === 0) {
		return "Today";
	}

	if (dayDifference === 1) {
		return "Tomorrow";
	}

	if (dayDifference === -1) {
		return "Yesterday";
	}

	const distance = formatRelativeDateDistance(dayDifference);
	return dayDifference > 0 ? `In ${distance}` : `${distance} ago`;
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
	// Fall back to 1 hour so the calendar can still render date availability before a duration is selected.
	// The form validation still requires a real duration before showing accurate times or submitting.
	return 60;
}

function getUtcDateForZonedDateTime(dateValue: string, timeValue: string, timeZone: string) {
	const date = parseDateValue(dateValue);
	if (!date) {
		return null;
	}

	const [hours, minutes] = timeValue.split(":").map(Number);
	return getUtcDateForZonedParts({
		day: date.getDate(),
		hours,
		minutes,
		month: date.getMonth() + 1,
		timeZone,
		year: date.getFullYear(),
	});
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
