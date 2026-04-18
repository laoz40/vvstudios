import { ConvexError } from "convex/values";

export interface BusyWindow {
	start: string;
	end: string;
}

export interface BusyDayWindow {
	date: string;
	label: string;
	busyPeriods: Array<{
		end: string;
		start: string;
	}>;
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

type BookingTimeUtilsErrorData = {
	code: BookingTimeUtilsErrorCode;
};

function createBookingTimeUtilsError(code: BookingTimeUtilsErrorCode) {
	return new ConvexError<BookingTimeUtilsErrorData>({ code });
}

// make every 30 minute time slot for one day
const TIME_OPTIONS = Array.from({ length: 48 }, (_, index) => {
	const hours = String(Math.floor(index / 2)).padStart(2, "0");
	const minutes = index % 2 === 0 ? "00" : "30";

	return `${hours}:${minutes}`;
});

export function parseDurationMinutes(duration: string) {
	if (duration === "1h") return 60;
	if (duration === "2h") return 120;
	if (duration === "3h") return 180;
	throw createBookingTimeUtilsError("BOOKING_INVALID_DURATION");
}

function parseDate(date: string): DateParts {
	const [year, month, day] = date.split("-").map(Number);

	if (!year || !month || !day) {
		throw createBookingTimeUtilsError("BOOKING_INVALID_DATE");
	}

	return { year, month, day };
}

function parseMonth(month: string): Pick<DateParts, "year" | "month"> {
	const [year, monthNumber] = month.split("-").map(Number);

	if (!year || !monthNumber) {
		throw createBookingTimeUtilsError("BOOKING_INVALID_MONTH");
	}

	return { year, month: monthNumber };
}

function parseTime(time: string): TimeParts {
	const [hours, minutes] = time.split(":").map(Number);

	if (hours === undefined || minutes === undefined) {
		throw createBookingTimeUtilsError("BOOKING_INVALID_TIME");
	}

	return { hours, minutes };
}

// keep one formatter per timezone so we can reuse it
const timeZoneFormatterCache = new Map<string, Intl.DateTimeFormat>();

// make a formatter that shows a date in the chosen timezone
function getTimeZoneFormatter(timeZone: string) {
	const cachedFormatter = timeZoneFormatterCache.get(timeZone);

	if (cachedFormatter) {
		return cachedFormatter;
	}

	const formatter = new Intl.DateTimeFormat("en-CA", {
		hour: "2-digit",
		hour12: false,
		hourCycle: "h23",
		minute: "2-digit",
		month: "2-digit",
		second: "2-digit",
		timeZone,
		year: "numeric",
		day: "2-digit",
	});

	timeZoneFormatterCache.set(timeZone, formatter);

	return formatter;
}

// break a date into year month day hour and minute for that timezone
interface TimeZoneParts extends DateParts, TimeParts {}

function getTimeZoneParts(date: Date, timeZone: string): TimeZoneParts {
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

// turn a local date and time in a timezone into a real utc date
export function getUtcDateForZonedDateTime(date: string, time: string, timeZone: string) {
	const dateParts = parseDate(date);
	const timeParts = parseTime(time);
	const targetUtcMs = Date.UTC(
		dateParts.year,
		dateParts.month - 1,
		dateParts.day,
		timeParts.hours,
		timeParts.minutes,
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

export function buildEventWindow(date: string, time: string, duration: string, timeZone: string) {
	const durationMinutes = parseDurationMinutes(duration);
	const startUtc = getUtcDateForZonedDateTime(date, time, timeZone);
	const endUtc = new Date(startUtc.getTime() + durationMinutes * 60 * 1000);

	return {
		startDateTime: startUtc.toISOString(),
		endDateTime: endUtc.toISOString(),
	};
}

// keep only the times that do not overlap with busy calendar events
interface GetAvailableTimeOptionsArgs {
	busyWindows: BusyWindow[];
	date: string;
	duration: string;
	timeZone: string;
}

export function getAvailableTimeOptions({
	busyWindows,
	date,
	duration,
	timeZone,
}: GetAvailableTimeOptionsArgs) {
	return TIME_OPTIONS.filter((time) =>
		isTimeSlotAvailable({
			busyWindows,
			date,
			duration,
			time,
			timeZone,
		}),
	);
}

// check if one booking time overlaps with any busy calendar event
interface IsTimeSlotAvailableArgs {
	busyWindows: BusyWindow[];
	date: string;
	duration: string;
	time: string;
	timeZone: string;
}

export function isTimeSlotAvailable({
	busyWindows,
	date,
	duration,
	time,
	timeZone,
}: IsTimeSlotAvailableArgs) {
	const { endDateTime, startDateTime } = buildEventWindow(date, time, duration, timeZone);
	const startMs = Date.parse(startDateTime);
	const endMs = Date.parse(endDateTime);

	return !busyWindows.some((window) => {
		const busyStartMs = Date.parse(window.start);
		const busyEndMs = Date.parse(window.end);

		return startMs < busyEndMs && endMs > busyStartMs;
	});
}

// wider search range for google calendar
// this helps catch events that start the night before or end the next day
// and still block time on the selected date
export function getAvailabilityRange(date: string) {
	return {
		timeMin: getUtcDateForBufferedQuery(getPreviousDate(date), "00:00").toISOString(),
		timeMax: getUtcDateForBufferedQuery(getNextDate(date), "23:59").toISOString(),
	};
}

export function getMonthAvailabilityRange(month: string, timeZone: string) {
	const { year, month: monthNumber } = parseMonth(month);
	const startOfMonth = `${year}-${String(monthNumber).padStart(2, "0")}-01`;
	const startOfNextMonth =
		monthNumber === 12
			? `${year + 1}-01-01`
			: `${year}-${String(monthNumber + 1).padStart(2, "0")}-01`;

	return {
		timeMax: getUtcDateForZonedDateTime(startOfNextMonth, "00:00", timeZone).toISOString(),
		timeMin: getUtcDateForZonedDateTime(startOfMonth, "00:00", timeZone).toISOString(),
	};
}

export function mergeBusyWindows(busyWindows: BusyWindow[]) {
	const sortedWindows = busyWindows
		.map((window) => ({
			endMs: Date.parse(window.end),
			startMs: Date.parse(window.start),
		}))
		.sort((left, right) => left.startMs - right.startMs);

	const mergedWindows: BusyWindow[] = [];

	for (const window of sortedWindows) {
		const lastWindow = mergedWindows.at(-1);
		if (!lastWindow) {
			mergedWindows.push({
				end: new Date(window.endMs).toISOString(),
				start: new Date(window.startMs).toISOString(),
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
			start: new Date(window.startMs).toISOString(),
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
				getUtcDateForZonedDateTime(getNextDate(localDateKey), "00:00", timeZone).toISOString(),
			);
			const segmentEndMs = Math.min(windowEndMs, dayEndMs);
			const bucket = getOrCreateDayBucket(dayBuckets, localDateKey, timeZone);

			bucket.busyPeriods.push({
				end: formatTimeInTimeZone(
					new Date(segmentEndMs === dayEndMs ? segmentEndMs - 60 * 1000 : segmentEndMs),
					timeZone,
				),
				start: formatTimeInTimeZone(segmentStartDate, timeZone),
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
	timeZone: string,
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
	const parts = getTimeZoneFormatter(timeZone).formatToParts(date);
	const values = Object.fromEntries(
		parts.filter((part) => part.type !== "literal").map((part) => [part.type, Number(part.value)]),
	) as Record<"day" | "month" | "year", number>;

	return `${values.year}-${String(values.month).padStart(2, "0")}-${String(values.day).padStart(2, "0")}`;
}

function getOrCreateDayBucket(
	dayBuckets: Map<string, BusyDayWindow>,
	date: string,
	timeZone: string,
) {
	const existingBucket = dayBuckets.get(date);
	if (existingBucket) {
		return existingBucket;
	}

	const bucket: BusyDayWindow = {
		busyPeriods: [],
		date,
		label: formatDayLabel(date, timeZone),
	};
	dayBuckets.set(date, bucket);

	return bucket;
}

function formatDayLabel(date: string, timeZone: string) {
	return new Intl.DateTimeFormat("en-US", {
		day: "numeric",
		month: "short",
		weekday: "short",
		timeZone,
	}).format(getUtcDateForZonedDateTime(date, "12:00", timeZone));
}

function formatTimeInTimeZone(date: Date, timeZone: string) {
	return new Intl.DateTimeFormat("en-US", {
		hour: "numeric",
		hour12: true,
		minute: "2-digit",
		timeZone,
	}).format(date);
}
