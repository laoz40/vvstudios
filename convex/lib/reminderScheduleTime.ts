const HOURS_PER_DAY = 24;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

export type TimeZoneDateParts = { year: number; month: number; day: number; hour: number };

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

export const getTimeZoneDateParts = (date: Date, timeZone: string): TimeZoneDateParts => {
	const parts = Object.fromEntries(
		getDateTimeFormatter(timeZone)
			.formatToParts(date)
			.filter((part) => part.type !== "literal")
			.map((part) => [part.type, Number(part.value)])
	);

	return {
		day: parts.day,
		hour: parts.hour === HOURS_PER_DAY ? 0 : parts.hour,
		month: parts.month,
		year: parts.year
	};
};

export const getUtcTimeForTimeZoneDateParts = (
	{ year, month, day, hour }: TimeZoneDateParts,
	timeZone: string
) => {
	const utcGuess = Date.UTC(year, month - 1, day, hour);
	const actualParts = getTimeZoneDateParts(new Date(utcGuess), timeZone);
	const targetAsUtc = Date.UTC(year, month - 1, day, hour);
	const actualAsUtc = Date.UTC(
		actualParts.year,
		actualParts.month - 1,
		actualParts.day,
		actualParts.hour
	);

	return utcGuess - (actualAsUtc - targetAsUtc);
};

export const getTimeZoneDayRange = (date: Date, timeZone: string, dayOffset = 0) => {
	const currentDay = getTimeZoneDateParts(date, timeZone);
	const targetDate = new Date(
		Date.UTC(currentDay.year, currentDay.month - 1, currentDay.day) + dayOffset * MS_PER_DAY
	);
	const nextDate = new Date(targetDate.getTime() + MS_PER_DAY);
	const targetDay = getTimeZoneDateParts(targetDate, timeZone);
	const nextDay = getTimeZoneDateParts(nextDate, timeZone);

	return {
		dayEnd: getUtcTimeForTimeZoneDateParts({ ...nextDay, hour: 0 }, timeZone),
		dayStart: getUtcTimeForTimeZoneDateParts({ ...targetDay, hour: 0 }, timeZone)
	};
};

export const getTomorrowTimeZoneDayRange = (date: Date, timeZone: string) =>
	getTimeZoneDayRange(date, timeZone, 1);
