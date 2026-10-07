import { parseCalendarDate, parseYearMonth, type CalendarDate } from "#studio/lib/calendarDate";
import {
	getTimeZoneDate,
	getTimeZoneDayRange,
	getUtcTimeForTimeZoneDate
} from "#convex/lib/reminderScheduleTime";

export type AdminSearchSessionStartRange = { rangeEnd: number; rangeStart: number };

const ENGLISH_MONTH_NAMES: { month: number; names: string[] }[] = [
	{ month: 1, names: ["jan", "january"] },
	{ month: 2, names: ["feb", "february"] },
	{ month: 3, names: ["mar", "march"] },
	{ month: 4, names: ["apr", "april"] },
	{ month: 5, names: ["may"] },
	{ month: 6, names: ["jun", "june"] },
	{ month: 7, names: ["jul", "july"] },
	{ month: 8, names: ["aug", "august"] },
	{ month: 9, names: ["sep", "sept", "september"] },
	{ month: 10, names: ["oct", "october"] },
	{ month: 11, names: ["nov", "november"] },
	{ month: 12, names: ["dec", "december"] }
];

function monthNumberFromEnglishName(monthName: string): number | null {
	for (const entry of ENGLISH_MONTH_NAMES) {
		if (entry.names.includes(monthName)) {
			return entry.month;
		}
	}

	return null;
}

const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const ISO_YEAR_MONTH_PATTERN = /^\d{4}-\d{2}$/;

const AU_DAY_MONTH_YEAR_PATTERN = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})$/;

const AU_MONTH_YEAR_PATTERN = /^(\d{1,2})[/.-](\d{4})$/;

const MONTH_NAME_PATTERN = /^([a-z]+)(?:\s+(\d{4}))?$/;

function expandTwoDigitYear(yearPart: number): number {
	if (yearPart >= 100) {
		return yearPart;
	}

	return 2000 + yearPart;
}

function calendarDateToIso({ day, month, year }: CalendarDate): string {
	return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function getSingleDayRangeFromCalendarDate(
	calendarDate: CalendarDate,
	timeZone: string
): AdminSearchSessionStartRange {
	const anchorDate = new Date(
		Date.UTC(calendarDate.year, calendarDate.month - 1, calendarDate.day)
	);

	const { dayEnd, dayStart } = getTimeZoneDayRange(anchorDate, timeZone, 0);

	return { rangeEnd: dayEnd, rangeStart: dayStart };
}

function getMonthRange(
	year: number,
	month: number,
	timeZone: string
): AdminSearchSessionStartRange {
	const nextMonth = month === 12 ? { month: 1, year: year + 1 } : { month: month + 1, year };

	return {
		rangeEnd: getUtcTimeForTimeZoneDate({ ...nextMonth, day: 1, hour: 0 }, timeZone),
		rangeStart: getUtcTimeForTimeZoneDate({ year, month, day: 1, hour: 0 }, timeZone)
	};
}

function parseAuDayMonthYear(value: string, timeZone: string): AdminSearchSessionStartRange | null {
	const match = AU_DAY_MONTH_YEAR_PATTERN.exec(value);

	if (!match) {
		return null;
	}

	const day = Number(match[1]);
	const month = Number(match[2]);
	const year = expandTwoDigitYear(Number(match[3]));
	const isoDate = calendarDateToIso({ day, month, year });

	if (parseCalendarDate(isoDate) === null) {
		return null;
	}

	return getSingleDayRangeFromCalendarDate({ day, month, year }, timeZone);
}

function parseAuMonthYear(value: string, timeZone: string): AdminSearchSessionStartRange | null {
	const match = AU_MONTH_YEAR_PATTERN.exec(value);

	if (!match) {
		return null;
	}

	const month = Number(match[1]);
	const year = Number(match[2]);

	if (month < 1 || month > 12) {
		return null;
	}

	return getMonthRange(year, month, timeZone);
}

function parseMonthName(
	value: string,
	timeZone: string,
	now: Date
): AdminSearchSessionStartRange | null {
	const normalized = value.trim().toLowerCase().replace(/\s+/g, " ");
	const match = MONTH_NAME_PATTERN.exec(normalized);

	if (!match) {
		return null;
	}

	const monthName = match[1];

	if (monthName === undefined) {
		return null;
	}

	const month = monthNumberFromEnglishName(monthName);

	if (month === null) {
		return null;
	}

	const yearPart = match[2];
	const year = yearPart ? Number(yearPart) : getTimeZoneDate(now, timeZone).year;

	return getMonthRange(year, month, timeZone);
}

function parseRelativeDay(
	keyword: "today" | "tomorrow" | "yesterday",
	timeZone: string,
	now: Date
): AdminSearchSessionStartRange {
	let dayOffset = -1;

	if (keyword === "today") {
		dayOffset = 0;
	} else if (keyword === "tomorrow") {
		dayOffset = 1;
	}

	const { dayEnd, dayStart } = getTimeZoneDayRange(now, timeZone, dayOffset);

	return { rangeEnd: dayEnd, rangeStart: dayStart };
}

export function parseAdminSearchDateValue(
	rawValue: string,
	args: { now: Date; timeZone: string }
): AdminSearchSessionStartRange | null {
	const value = rawValue.trim();

	if (value.length === 0) {
		return null;
	}

	const normalizedKeyword = value.toLowerCase();

	if (
		normalizedKeyword === "today" ||
		normalizedKeyword === "tomorrow" ||
		normalizedKeyword === "yesterday"
	) {
		return parseRelativeDay(normalizedKeyword, args.timeZone, args.now);
	}

	if (ISO_DATE_PATTERN.test(value)) {
		const calendarDate = parseCalendarDate(value);

		if (calendarDate === null) {
			return null;
		}

		return getSingleDayRangeFromCalendarDate(calendarDate, args.timeZone);
	}

	if (ISO_YEAR_MONTH_PATTERN.test(value)) {
		const yearMonth = parseYearMonth(value);

		if (yearMonth === null) {
			return null;
		}

		return getMonthRange(yearMonth.year, yearMonth.month, args.timeZone);
	}

	const auDayRange = parseAuDayMonthYear(value, args.timeZone);

	if (auDayRange !== null) {
		return auDayRange;
	}

	const auMonthRange = parseAuMonthYear(value, args.timeZone);

	if (auMonthRange !== null) {
		return auMonthRange;
	}

	return parseMonthName(value, args.timeZone, args.now);
}
