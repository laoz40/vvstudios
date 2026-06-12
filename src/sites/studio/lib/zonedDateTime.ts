import { err, ok, type Result } from "#/lib/result";

const timeZoneFormatterCache = new Map<string, Intl.DateTimeFormat>();

type ZonedDateTimeParts = {
	day: number;
	hours: number;
	minutes: number;
	month: number;
	timeZone: string;
	year: number;
};

type TimeZoneParts = Omit<ZonedDateTimeParts, "timeZone">;

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
		year: "numeric"
	});

	timeZoneFormatterCache.set(timeZone, formatter);

	return formatter;
}

function getTimeZoneParts(date: Date, timeZone: string): TimeZoneParts {
	const parts = getTimeZoneFormatter(timeZone).formatToParts(date);
	const values = Object.fromEntries(
		parts.filter((part) => part.type !== "literal").map((part) => [part.type, Number(part.value)])
	) as Record<"day" | "hour" | "minute" | "month" | "second" | "year", number>;

	return {
		day: values.day,
		hours: values.hour === 24 ? 0 : values.hour,
		minutes: values.minute,
		month: values.month,
		year: values.year
	};
}

export function getTimeZoneDateKey(date: Date, timeZone: string) {
	const parts = getTimeZoneParts(date, timeZone);

	return `${parts.year}-${String(parts.month).padStart(2, "0")}-${String(parts.day).padStart(2, "0")}`;
}

export function getUtcDateForZonedParts({
	day,
	hours,
	minutes,
	month,
	timeZone,
	year
}: ZonedDateTimeParts): Result<Date, { reason: "INVALID_ZONED_TIME" }> {
	const targetUtcMs = Date.UTC(year, month - 1, day, hours, minutes, 0, 0);
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
			0
		);
		const diffMs = targetUtcMs - currentUtcMs;

		guessUtcMs += diffMs;

		if (diffMs === 0) {
			break;
		}
	}

	const resolvedDate = new Date(guessUtcMs);
	const resolvedParts = getTimeZoneParts(resolvedDate, timeZone);

	if (
		resolvedParts.year !== year ||
		resolvedParts.month !== month ||
		resolvedParts.day !== day ||
		resolvedParts.hours !== hours ||
		resolvedParts.minutes !== minutes
	) {
		return err({ reason: "INVALID_ZONED_TIME" });
	}

	return ok(resolvedDate);
}
