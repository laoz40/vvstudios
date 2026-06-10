import { ConvexError } from "convex/values";
import {
	BOOKING_EVENT_BUFFER_MINUTES,
	BOOKING_TIME_OPTIONS
} from "../../src/sites/studio/lib/bookingAvailabilitySettings";
import {
	getTimeZoneDateKey,
	getUtcDateForZonedParts
} from "../../src/sites/studio/lib/zonedDateTime";

export interface BusyWindow {
	start: string;
	end: string;
}

export interface BusyDayWindow {
	date: string;
	label: string;
	busyPeriods: Array<{ end: string; start: string }>;
}

interface DateParts {
	year: number;
	month: number;
	day: number;
}

interface TimeParts {
	hours: number;
	minutes: number;
}

type BookingTimeUtilsErrorCode =
	| "BOOKING_INVALID_DATE"
	| "BOOKING_INVALID_DURATION"
	| "BOOKING_INVALID_MONTH"
	| "BOOKING_INVALID_TIME";

type BookingTimeUtilsErrorData = { code: BookingTimeUtilsErrorCode };

export type BookingAvailabilitySettings = {
	eventBufferMinutes: number;
	leadTimeMinutes: number;
	maxDaysAhead: number;
	weekSchedule: Array<{ endTime: string; startTime: string }>;
};

type BookingAvailabilityValidationErrorData = {
	code:
		| "BOOKING_INVALID_DATE"
		| "BOOKING_OUTSIDE_OPENING_HOURS"
		| "BOOKING_TOO_FAR_AHEAD"
		| "BOOKING_TOO_SOON";
};

export function parseDurationMinutes(duration: string) {
	if (duration === "1h") return 60;
	if (duration === "2h") return 120;
	if (duration === "3h") return 180;
	throw new ConvexError<BookingTimeUtilsErrorData>({ code: "BOOKING_INVALID_DURATION" });
}

function parseDate(date: string): DateParts {
	const [year, month, day] = date.split("-").map(Number);

	if (!year || !month || !day) {
		throw new ConvexError<BookingTimeUtilsErrorData>({ code: "BOOKING_INVALID_DATE" });
	}

	return { year, month, day };
}

function parseTime(time: string): TimeParts {
	const [hours, minutes] = time.split(":").map(Number);

	if (hours === undefined || minutes === undefined) {
		throw new ConvexError<BookingTimeUtilsErrorData>({ code: "BOOKING_INVALID_TIME" });
	}

	return { hours, minutes };
}

// turn a local date and time in a timezone into a real utc date
export function getUtcDateForZonedDateTime(date: string, time: string, timeZone: string) {
	const dateParts = parseDate(date);
	const timeParts = parseTime(time);
	return getUtcDateForZonedParts({
		day: dateParts.day,
		hours: timeParts.hours,
		minutes: timeParts.minutes,
		month: dateParts.month,
		timeZone,
		year: dateParts.year
	});
}

export function buildEventWindow(date: string, time: string, duration: string, timeZone: string) {
	const durationMinutes = parseDurationMinutes(duration);
	const startUtc = getUtcDateForZonedDateTime(date, time, timeZone);
	const endUtc = new Date(startUtc.getTime() + durationMinutes * 60 * 1000);

	return { startDateTime: startUtc.toISOString(), endDateTime: endUtc.toISOString() };
}

// keep only the times that do not overlap with busy calendar events
interface GetAvailableTimeOptionsArgs {
	busyWindows: BusyWindow[];
	date: string;
	duration: string;
	eventBufferMinutes?: number;
	timeZone: string;
}

export function getAvailableTimeOptions({
	busyWindows,
	date,
	duration,
	eventBufferMinutes = BOOKING_EVENT_BUFFER_MINUTES,
	timeZone
}: GetAvailableTimeOptionsArgs) {
	return BOOKING_TIME_OPTIONS.filter((time) =>
		isTimeSlotAvailable({ busyWindows, date, duration, eventBufferMinutes, time, timeZone })
	);
}

// check if one booking time overlaps with any busy calendar event
interface IsTimeSlotAvailableArgs {
	busyWindows: BusyWindow[];
	date: string;
	duration: string;
	eventBufferMinutes?: number;
	time: string;
	timeZone: string;
}

export function isTimeSlotAvailable({
	busyWindows,
	date,
	duration,
	eventBufferMinutes = BOOKING_EVENT_BUFFER_MINUTES,
	time,
	timeZone
}: IsTimeSlotAvailableArgs) {
	const { endDateTime, startDateTime } = buildEventWindow(date, time, duration, timeZone);
	const startMs = Date.parse(startDateTime);
	const endMs = Date.parse(endDateTime);

	return !busyWindows.some((window) => {
		const busyStartMs = Date.parse(window.start) - eventBufferMinutes * 60 * 1000;
		const busyEndMs = Date.parse(window.end) + eventBufferMinutes * 60 * 1000;

		return startMs < busyEndMs && endMs > busyStartMs;
	});
}

// wider search range for google calendar
// this helps catch events that start the night before or end the next day
// and still block time on the selected date
function parseDateValue(value: string) {
	const [year, month, day] = value.split("-").map(Number);
	if (!year || !month || !day) {
		throw new ConvexError<BookingAvailabilityValidationErrorData>({ code: "BOOKING_INVALID_DATE" });
	}

	return new Date(year, month - 1, day);
}

function parseTimeToMinutes(time: string) {
	const [hours, minutes] = time.split(":").map(Number);
	return hours * 60 + minutes;
}

function startOfToday(now = new Date()) {
	return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

function addDays(date: Date, days: number) {
	const result = new Date(date);
	result.setDate(result.getDate() + days);
	return result;
}

export function checkBookingMeetsAvailabilitySettings({
	date,
	duration,
	now = Date.now(),
	settings,
	time,
	timeZone
}: {
	date: string;
	duration: string;
	now?: number;
	settings: BookingAvailabilitySettings;
	time: string;
	timeZone: string;
}) {
	const bookingDate = parseDateValue(date);
	const today = startOfToday(new Date(now));
	const lastBookableDate = addDays(today, settings.maxDaysAhead);

	if (bookingDate < today) {
		throw new ConvexError<BookingAvailabilityValidationErrorData>({ code: "BOOKING_TOO_SOON" });
	}

	if (bookingDate > lastBookableDate) {
		throw new ConvexError<BookingAvailabilityValidationErrorData>({
			code: "BOOKING_TOO_FAR_AHEAD"
		});
	}

	const daySchedule = settings.weekSchedule[bookingDate.getDay()];
	if (!daySchedule) {
		throw new ConvexError<BookingAvailabilityValidationErrorData>({
			code: "BOOKING_OUTSIDE_OPENING_HOURS"
		});
	}

	const startMinutes = parseTimeToMinutes(time);
	const endMinutes = startMinutes + parseDurationMinutes(duration);
	const dayStartMinutes = parseTimeToMinutes(daySchedule.startTime);
	const dayEndMinutes = parseTimeToMinutes(daySchedule.endTime);

	if (startMinutes < dayStartMinutes || endMinutes > dayEndMinutes) {
		throw new ConvexError<BookingAvailabilityValidationErrorData>({
			code: "BOOKING_OUTSIDE_OPENING_HOURS"
		});
	}

	const bookingStartAt = getUtcDateForZonedDateTime(date, time, timeZone).getTime();
	const earliestStartAt = now + settings.leadTimeMinutes * 60 * 1000;

	if (bookingStartAt < earliestStartAt) {
		throw new ConvexError<BookingAvailabilityValidationErrorData>({ code: "BOOKING_TOO_SOON" });
	}
}

export function getAvailabilityRange(date: string) {
	return {
		timeMin: getUtcDateForBufferedQuery(getPreviousDate(date), "00:00").toISOString(),
		timeMax: getUtcDateForBufferedQuery(getNextDate(date), "23:59").toISOString()
	};
}

export function getDateAvailabilityRange(startDate: string, endDate: string, timeZone: string) {
	return {
		timeMax: getUtcDateForZonedDateTime(getNextDate(endDate), "00:00", timeZone).toISOString(),
		timeMin: getUtcDateForZonedDateTime(startDate, "00:00", timeZone).toISOString()
	};
}

export function mergeBusyWindows(busyWindows: BusyWindow[]) {
	const sortedWindows = busyWindows
		.map((window) => ({ endMs: Date.parse(window.end), startMs: Date.parse(window.start) }))
		.sort((left, right) => left.startMs - right.startMs);

	const mergedWindows: BusyWindow[] = [];

	for (const window of sortedWindows) {
		const lastWindow = mergedWindows.at(-1);
		if (!lastWindow) {
			mergedWindows.push({
				end: new Date(window.endMs).toISOString(),
				start: new Date(window.startMs).toISOString()
			});
			continue;
		}

		const lastEndMs = Date.parse(lastWindow.end);
		if (window.startMs <= lastEndMs) {
			lastWindow.end = new Date(Math.max(lastEndMs, window.endMs)).toISOString();
			continue;
		}

		mergedWindows.push({
			end: new Date(window.endMs).toISOString(),
			start: new Date(window.startMs).toISOString()
		});
	}

	return mergedWindows;
}

export function groupBusyWindowsByDay(busyWindows: BusyWindow[], timeZone: string) {
	const mergedWindows = mergeBusyWindows(busyWindows);
	const dayBuckets = new Map<string, BusyDayWindow>();

	for (const window of mergedWindows) {
		let segmentStartMs = Date.parse(window.start);
		const windowEndMs = Date.parse(window.end);

		while (segmentStartMs < windowEndMs) {
			const segmentStartDate = new Date(segmentStartMs);
			const localDateKey = getLocalDateKey(segmentStartDate, timeZone);
			const dayEndMs = Date.parse(
				getUtcDateForZonedDateTime(getNextDate(localDateKey), "00:00", timeZone).toISOString()
			);
			const segmentEndMs = Math.min(windowEndMs, dayEndMs);
			const bucket = getOrCreateDayBucket(dayBuckets, localDateKey, timeZone);

			bucket.busyPeriods.push({
				end: formatTimeInTimeZone(
					new Date(segmentEndMs === dayEndMs ? segmentEndMs - 60 * 1000 : segmentEndMs),
					timeZone
				),
				start: formatTimeInTimeZone(segmentStartDate, timeZone)
			});

			segmentStartMs = segmentEndMs;
		}
	}

	return Array.from(dayBuckets.values());
}

// turn google event dates into one normal datetime value we can compare (for all day events)
interface EventDateTimeRange {
	date?: string | null;
	dateTime?: string | null;
}

export function getEventDateTime(
	dateTimeRange: EventDateTimeRange | null | undefined,
	timeZone: string
) {
	if (dateTimeRange?.dateTime) {
		return dateTimeRange.dateTime;
	}

	if (dateTimeRange?.date) {
		return getUtcDateForZonedDateTime(dateTimeRange.date, "00:00", timeZone).toISOString();
	}

	return null;
}

function getUtcDateForBufferedQuery(date: string, time: string) {
	return new Date(`${date}T${time}:00.000Z`);
}

function getPreviousDate(date: string) {
	const [year, month, day] = date.split("-").map(Number);
	const previousDate = new Date(Date.UTC(year, month - 1, day - 1, 0, 0, 0, 0));

	const previousYear = previousDate.getUTCFullYear();
	const previousMonth = String(previousDate.getUTCMonth() + 1).padStart(2, "0");
	const previousDay = String(previousDate.getUTCDate()).padStart(2, "0");

	return `${previousYear}-${previousMonth}-${previousDay}`;
}

function getNextDate(date: string) {
	const [year, month, day] = date.split("-").map(Number);
	const nextDate = new Date(Date.UTC(year, month - 1, day + 1, 0, 0, 0, 0));

	const nextYear = nextDate.getUTCFullYear();
	const nextMonth = String(nextDate.getUTCMonth() + 1).padStart(2, "0");
	const nextDay = String(nextDate.getUTCDate()).padStart(2, "0");

	return `${nextYear}-${nextMonth}-${nextDay}`;
}

function getLocalDateKey(date: Date, timeZone: string) {
	return getTimeZoneDateKey(date, timeZone);
}

function getOrCreateDayBucket(
	dayBuckets: Map<string, BusyDayWindow>,
	date: string,
	timeZone: string
) {
	const existingBucket = dayBuckets.get(date);
	if (existingBucket) {
		return existingBucket;
	}

	const bucket: BusyDayWindow = { busyPeriods: [], date, label: formatDayLabel(date, timeZone) };
	dayBuckets.set(date, bucket);

	return bucket;
}

function formatDayLabel(date: string, timeZone: string) {
	return new Intl.DateTimeFormat("en-US", {
		day: "numeric",
		month: "short",
		weekday: "short",
		timeZone
	}).format(getUtcDateForZonedDateTime(date, "12:00", timeZone));
}

function formatTimeInTimeZone(date: Date, timeZone: string) {
	return new Intl.DateTimeFormat("en-US", {
		hour: "numeric",
		hour12: true,
		minute: "2-digit",
		timeZone
	}).format(date);
}

export function formatCalendarEventDate(dateTime: string, timeZone: string) {
	return new Intl.DateTimeFormat("en-AU", {
		weekday: "long",
		month: "long",
		day: "numeric",
		year: "numeric",
		timeZone
	}).format(new Date(dateTime));
}

export function formatCalendarEventTime(dateTime: string, timeZone: string) {
	return new Intl.DateTimeFormat("en-AU", {
		hour: "numeric",
		minute: "2-digit",
		hour12: true,
		timeZone
	}).format(new Date(dateTime));
}

export function formatBookingDateLong(date: string) {
	const [year, month, day] = date.split("-").map(Number);

	if (!year || !month || !day) {
		return date;
	}

	return new Intl.DateTimeFormat("en-AU", {
		weekday: "long",
		month: "long",
		day: "numeric",
		year: "numeric"
	}).format(new Date(year, month - 1, day));
}

export function formatBookingDateWithoutYear(date: string) {
	const [, month, day] = date.split("-").map(Number);

	if (!month || !day) {
		return date;
	}

	const suffix = getOrdinalSuffix(day);
	const monthLabel = new Intl.DateTimeFormat("en-AU", { month: "long" }).format(
		new Date(2000, month - 1, day)
	);

	return `${day}${suffix} ${monthLabel}`;
}

function getOrdinalSuffix(day: number) {
	if (day >= 11 && day <= 13) {
		return "th";
	}

	switch (day % 10) {
		case 1:
			return "st";
		case 2:
			return "nd";
		case 3:
			return "rd";
		default:
			return "th";
	}
}

export function formatBookingDateShort(date: string) {
	const [year, month, day] = date.split("-");

	if (!year || !month || !day) {
		return date;
	}

	return `${day}/${month}/${year.slice(-2)}`;
}
