import { parseTimeZoneDate, type TimeZoneDate } from "#studio/lib/calendarDate";

const HOURS_PER_DAY = 24;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

export const REMINDER_BATCH_SIZE = 50;
export const REMINDER_TIME_ZONE = "Australia/Sydney";

export type { TimeZoneDate };

const dateTimeFormatters = new Map<string, Intl.DateTimeFormat>();

const getDateTimeFormatter = (timeZone: string) => {
	const cachedFormatter = dateTimeFormatters.get(timeZone);
	if (cachedFormatter) {
		return cachedFormatter;
	}

	const formatter = new Intl.DateTimeFormat("en-AU", {
		day: "2-digit",
		hour: "2-digit",
		hour12: false,
		month: "2-digit",
		timeZone,
		year: "numeric"
	});

	dateTimeFormatters.set(timeZone, formatter);

	return formatter;
};

export const getTimeZoneDate = (date: Date, timeZone: string): TimeZoneDate => {
	const values = Object.fromEntries(
		getDateTimeFormatter(timeZone)
			.formatToParts(date)
			.filter((part) => part.type !== "literal")
			.map((part) => [part.type, Number(part.value)])
	);

	const timeZoneDate = parseTimeZoneDate(values);

	if (!timeZoneDate) {
		throw new Error(`Failed to parse date parts for time zone ${timeZone}`);
	}

	return {
		day: timeZoneDate.day,
		hour: timeZoneDate.hour === HOURS_PER_DAY ? 0 : timeZoneDate.hour,
		month: timeZoneDate.month,
		year: timeZoneDate.year
	};
};

export const getUtcTimeForTimeZoneDate = (
	{ year, month, day, hour }: TimeZoneDate,
	timeZone: string
) => {
	const utcGuess = Date.UTC(year, month - 1, day, hour);
	const actualDate = getTimeZoneDate(new Date(utcGuess), timeZone);
	const targetAsUtc = Date.UTC(year, month - 1, day, hour);
	const actualAsUtc = Date.UTC(actualDate.year, actualDate.month - 1, actualDate.day, actualDate.hour);

	return utcGuess - (actualAsUtc - targetAsUtc);
};

export const getTimeZoneDayRange = (date: Date, timeZone: string, dayOffset = 0) => {
	const currentDay = getTimeZoneDate(date, timeZone);
	const targetDate = new Date(
		Date.UTC(currentDay.year, currentDay.month - 1, currentDay.day) + dayOffset * MS_PER_DAY
	);
	const nextDate = new Date(targetDate.getTime() + MS_PER_DAY);
	const targetDay = getTimeZoneDate(targetDate, timeZone);
	const nextDay = getTimeZoneDate(nextDate, timeZone);

	return {
		dayEnd: getUtcTimeForTimeZoneDate({ ...nextDay, hour: 0 }, timeZone),
		dayStart: getUtcTimeForTimeZoneDate({ ...targetDay, hour: 0 }, timeZone)
	};
};

export const getTomorrowTimeZoneDayRange = (date: Date, timeZone: string) =>
	getTimeZoneDayRange(date, timeZone, 1);
