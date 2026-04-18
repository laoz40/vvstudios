import { ConvexError } from "convex/values";

export interface BusyWindow {
	start: string;
	end: string;
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
