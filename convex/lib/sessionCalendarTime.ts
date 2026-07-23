import { err, ok, type Result } from "../../src/lib/result";
import {
	BOOKING_EVENT_BUFFER_MINUTES,
	BOOKING_TIME_OPTIONS
} from "../../src/sites/studio/lib/bookingAvailabilitySettings";
import {
	getTimeZoneDateKey,
	getUtcDateForZonedParts
} from "../../src/sites/studio/lib/zonedDateTime";

export interface BusyWindow {
	calendarId?: string;
	end: string;
	eventId?: string;
	start: string;
}

export interface BusyDayWindow {
	date: string;
	label: string;
	busyPeriods: Array<{ calendarId?: string; end: string; eventId?: string; start: string }>;
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

export type SessionAvailabilitySettings = {
	eventBufferMinutes: number;
	leadTimeMinutes: number;
	maxDaysAhead: number;
	weekSchedule: Array<{ endTime: string; startTime: string }>;
};

export type SessionAvailabilityValidationError = {
	reason:
		| "BOOKING_INVALID_DATE"
		| "BOOKING_INVALID_DURATION"
		| "BOOKING_INVALID_TIME"
		| "BOOKING_OUTSIDE_OPENING_HOURS"
		| "BOOKING_TOO_FAR_AHEAD"
		| "BOOKING_TOO_SOON"
		| "BOOKING_TIME_UNAVAILABLE";
};

type SessionTimeParseError =
	| { reason: "BOOKING_INVALID_DATE" }
	| { reason: "BOOKING_INVALID_DURATION" }
	| { reason: "BOOKING_INVALID_TIME" };

export function parseDurationMinutes(
	duration: string
): Result<number, { reason: "BOOKING_INVALID_DURATION" }> {
	if (duration === "1h") return ok(60);
	if (duration === "2h") return ok(120);
	if (duration === "3h") return ok(180);
	return err({ reason: "BOOKING_INVALID_DURATION" });
}

function isValidDateParts(
	year: number | undefined,
	month: number | undefined,
	day: number | undefined
) {
	return Number.isFinite(year) && Number.isFinite(month) && Number.isFinite(day);
}

function isValidTimeParts(hours: number | undefined, minutes: number | undefined) {
	return Number.isFinite(hours) && Number.isFinite(minutes);
}

function parseDate(date: string): Result<DateParts, { reason: "BOOKING_INVALID_DATE" }> {
	const [year, month, day] = date.split("-").map(Number);

	if (!isValidDateParts(year, month, day)) {
		return err({ reason: "BOOKING_INVALID_DATE" });
	}

	return ok({ year, month, day });
}

function parseTime(time: string): Result<TimeParts, { reason: "BOOKING_INVALID_TIME" }> {
	const [hours, minutes] = time.split(":").map(Number);

	if (!isValidTimeParts(hours, minutes)) {
		return err({ reason: "BOOKING_INVALID_TIME" });
	}

	return ok({ hours, minutes });
}

// turn a local date and time in a timezone into a real utc date
export function getUtcDateForZonedDateTime(
	date: string,
	time: string,
	timeZone: string
): Result<
	Date,
	| Exclude<SessionTimeParseError, { reason: "BOOKING_INVALID_DURATION" }>
	| { reason: "BOOKING_INVALID_TIME" }
> {
	const [dateError, dateParts] = parseDate(date);

	if (dateError !== null) {
		return err(dateError);
	}

	const [timeError, timeParts] = parseTime(time);

	if (timeError !== null) {
		return err(timeError);
	}

	const [zonedTimeError, utcDate] = getUtcDateForZonedParts({
		day: dateParts.day,
		hours: timeParts.hours,
		minutes: timeParts.minutes,
		month: dateParts.month,
		timeZone,
		year: dateParts.year
	});

	if (zonedTimeError !== null) {
		return err({ reason: "BOOKING_INVALID_TIME" });
	}

	return ok(utcDate);
}

export function buildEventWindow(
	date: string,
	time: string,
	duration: string,
	timeZone: string
): Result<{ startDateTime: string; endDateTime: string }, SessionTimeParseError> {
	const [durationError, durationMinutes] = parseDurationMinutes(duration);

	if (durationError !== null) {
		return err(durationError);
	}

	const [startError, startUtc] = getUtcDateForZonedDateTime(date, time, timeZone);

	if (startError !== null) {
		return err(startError);
	}

	const endUtc = new Date(startUtc.getTime() + durationMinutes * 60 * 1000);

	return ok({ startDateTime: startUtc.toISOString(), endDateTime: endUtc.toISOString() });
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

export function doSessionWindowsOverlap({
	firstDuration,
	firstStartAt,
	secondDuration,
	secondStartAt,
	eventBufferMinutes
}: {
	firstDuration: string;
	firstStartAt: number;
	secondDuration: string;
	secondStartAt: number;
	eventBufferMinutes: number;
}) {
	const [firstDurationError, firstDurationMinutes] = parseDurationMinutes(firstDuration);
	const [secondDurationError, secondDurationMinutes] = parseDurationMinutes(secondDuration);

	if (firstDurationError !== null || secondDurationError !== null) {
		return true;
	}

	const bufferMs = eventBufferMinutes * 60 * 1000;
	const firstEndAt = firstStartAt + firstDurationMinutes * 60 * 1000;
	const secondEndAt = secondStartAt + secondDurationMinutes * 60 * 1000;

	return firstStartAt < secondEndAt + bufferMs && firstEndAt + bufferMs > secondStartAt;
}

export function isTimeSlotAvailable({
	busyWindows,
	date,
	duration,
	eventBufferMinutes = BOOKING_EVENT_BUFFER_MINUTES,
	time,
	timeZone
}: IsTimeSlotAvailableArgs) {
	const [windowError, eventWindow] = buildEventWindow(date, time, duration, timeZone);

	if (windowError !== null) {
		return false;
	}

	const startMs = Date.parse(eventWindow.startDateTime);
	const endMs = Date.parse(eventWindow.endDateTime);

	return !busyWindows.some((window) => {
		const busyStartMs = Date.parse(window.start) - eventBufferMinutes * 60 * 1000;
		const busyEndMs = Date.parse(window.end) + eventBufferMinutes * 60 * 1000;

		return startMs < busyEndMs && endMs > busyStartMs;
	});
}

// wider search range for google calendar
// this helps catch events that start the night before or end the next day
// and still block time on the selected date
function parseDateValue(value: string): Result<Date, { reason: "BOOKING_INVALID_DATE" }> {
	const [year, month, day] = value.split("-").map(Number);

	if (!isValidDateParts(year, month, day)) {
		return err({ reason: "BOOKING_INVALID_DATE" });
	}

	return ok(new Date(year, month - 1, day));
}

function parseTimeToMinutes(time: string) {
	const [hours, minutes] = time.split(":").map(Number);

	if (!isValidTimeParts(hours, minutes)) {
		return null;
	}

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

export function checkSessionMeetsAvailabilitySettings({
	date,
	duration,
	latestBookableDate,
	now = Date.now(),
	settings,
	time,
	timeZone
}: {
	date: string;
	duration: string;
	latestBookableDate?: Date;
	now?: number;
	settings: SessionAvailabilitySettings;
	time: string;
	timeZone: string;
}): Result<null, SessionAvailabilityValidationError> {
	const [dateError, bookingDate] = parseDateValue(date);

	if (dateError !== null) {
		return err(dateError);
	}

	const [dateRangeError, daySchedule] = validateBookingDateRange(
		bookingDate,
		latestBookableDate,
		now,
		settings
	);

	if (dateRangeError !== null) {
		return err(dateRangeError);
	}

	const [scheduleError] = validateBookingDaySchedule(duration, time, daySchedule);

	if (scheduleError !== null) {
		return err(scheduleError);
	}

	const [startError, bookingStart] = getUtcDateForZonedDateTime(date, time, timeZone);

	if (startError !== null) {
		return err(startError);
	}

	const earliestStartAt = now + settings.leadTimeMinutes * 60 * 1000;

	if (bookingStart.getTime() < earliestStartAt) {
		return err({ reason: "BOOKING_TOO_SOON" });
	}

	return ok(null);
}

function validateBookingDateRange(
	bookingDate: Date,
	latestBookableDate: Date | undefined,
	now: number,
	settings: SessionAvailabilitySettings
): Result<{ endTime: string; startTime: string }, SessionAvailabilityValidationError> {
	const today = startOfToday(new Date(now));
	const lastBookableDate = latestBookableDate ?? addDays(today, settings.maxDaysAhead);

	if (bookingDate < today) {
		return err({ reason: "BOOKING_TOO_SOON" });
	}

	if (bookingDate > lastBookableDate) {
		return err({ reason: "BOOKING_TOO_FAR_AHEAD" });
	}

	const bookingDay = bookingDate.getDay();
	const daySchedule = settings.weekSchedule.find((_schedule, day) => day === bookingDay);

	if (!daySchedule) {
		return err({ reason: "BOOKING_OUTSIDE_OPENING_HOURS" });
	}

	return ok(daySchedule);
}

function validateBookingDaySchedule(
	duration: string,
	time: string,
	daySchedule: { endTime: string; startTime: string }
): Result<null, SessionAvailabilityValidationError> {
	const [durationError, durationMinutes] = parseDurationMinutes(duration);

	if (durationError !== null) {
		return err(durationError);
	}

	const startMinutes = parseTimeToMinutes(time);
	const dayStartMinutes = parseTimeToMinutes(daySchedule.startTime);
	const dayEndMinutes = parseTimeToMinutes(daySchedule.endTime);

	if (startMinutes === null || dayStartMinutes === null || dayEndMinutes === null) {
		return err({ reason: "BOOKING_INVALID_TIME" });
	}

	const endMinutes = startMinutes + durationMinutes;

	if (startMinutes < dayStartMinutes || endMinutes > dayEndMinutes) {
		return err({ reason: "BOOKING_OUTSIDE_OPENING_HOURS" });
	}

	return ok(null);
}

export function getAvailabilityRange(date: string) {
	return {
		timeMin: getUtcDateForBufferedQuery(getPreviousDate(date), "00:00").toISOString(),
		timeMax: getUtcDateForBufferedQuery(getNextDate(date), "23:59").toISOString()
	};
}

export function getDateAvailabilityRange(
	startDate: string,
	endDate: string,
	timeZone: string
): Result<
	{ timeMax: string; timeMin: string },
	Exclude<SessionTimeParseError, { reason: "BOOKING_INVALID_DURATION" }>
> {
	const [timeMaxError, timeMaxDate] = getUtcDateForZonedDateTime(
		getNextDate(endDate),
		"00:00",
		timeZone
	);

	if (timeMaxError !== null) {
		return err(timeMaxError);
	}

	const [timeMinError, timeMinDate] = getUtcDateForZonedDateTime(startDate, "00:00", timeZone);

	if (timeMinError !== null) {
		return err(timeMinError);
	}

	return ok({ timeMax: timeMaxDate.toISOString(), timeMin: timeMinDate.toISOString() });
}

export function groupBusyWindowsByDay(
	busyWindows: BusyWindow[],
	timeZone: string
): Result<BusyDayWindow[], Exclude<SessionTimeParseError, { reason: "BOOKING_INVALID_DURATION" }>> {
	const dayBuckets = new Map<string, BusyDayWindow>();

	for (const window of busyWindows) {
		let segmentStartMs = Date.parse(window.start);
		const windowEndMs = Date.parse(window.end);

		while (segmentStartMs < windowEndMs) {
			const segmentStartDate = new Date(segmentStartMs);
			const localDateKey = getLocalDateKey(segmentStartDate, timeZone);
			const [dayEndError, dayEndDate] = getUtcDateForZonedDateTime(
				getNextDate(localDateKey),
				"00:00",
				timeZone
			);

			if (dayEndError !== null) {
				return err(dayEndError);
			}

			const dayEndMs = Date.parse(dayEndDate.toISOString());
			const segmentEndMs = Math.min(windowEndMs, dayEndMs);
			const bucket = getOrCreateDayBucket(dayBuckets, localDateKey, timeZone);

			bucket.busyPeriods.push({
				...(window.calendarId ? { calendarId: window.calendarId } : {}),
				end: formatTimeInTimeZone(
					new Date(segmentEndMs === dayEndMs ? segmentEndMs - 60 * 1000 : segmentEndMs),
					timeZone
				),
				...(window.eventId ? { eventId: window.eventId } : {}),
				start: formatTimeInTimeZone(segmentStartDate, timeZone)
			});

			segmentStartMs = segmentEndMs;
		}
	}

	return ok(Array.from(dayBuckets.values()));
}

export function groupBusyDaysByMonth(busyDays: BusyDayWindow[]) {
	const busyWindowsByMonth: Record<string, BusyDayWindow[]> = {};

	for (const busyDay of busyDays) {
		const month = busyDay.date.slice(0, 7);
		busyWindowsByMonth[month] = [...(busyWindowsByMonth[month] ?? []), busyDay];
	}

	return busyWindowsByMonth;
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
		const [dateError, date] = getUtcDateForZonedDateTime(dateTimeRange.date, "00:00", timeZone);

		if (dateError !== null) {
			return null;
		}

		return date.toISOString();
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
	const [dateError, labelDate] = getUtcDateForZonedDateTime(date, "12:00", timeZone);

	if (dateError !== null) {
		return date;
	}

	return new Intl.DateTimeFormat("en-US", {
		day: "numeric",
		month: "short",
		weekday: "short",
		timeZone
	}).format(labelDate);
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

export function formatSessionDateLong(date: string) {
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

export function formatSessionDateWithoutYear(date: string) {
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

export function formatSessionDateShort(date: string) {
	const [year, month, day] = date.split("-");

	if (!year || !month || !day) {
		return date;
	}

	return `${day}/${month}/${year.slice(-2)}`;
}
