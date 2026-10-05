import type { Result } from "neverthrow";
import { parseCalendarDate } from "#studio/lib/calendarDate";
import {
	getUtcDateForZonedDateTime,
	type SessionTimeParseError
} from "#convex/lib/sessions/sessionCalendarTime";

function nextCalendarDate(date: string) {
	const calendarDate = parseCalendarDate(date);

	if (!calendarDate) {
		return date;
	}

	const nextDate = new Date(
		Date.UTC(calendarDate.year, calendarDate.month - 1, calendarDate.day + 1, 0, 0, 0, 0)
	);

	const nextYear = nextDate.getUTCFullYear();
	const nextMonth = String(nextDate.getUTCMonth() + 1).padStart(2, "0");
	const nextDay = String(nextDate.getUTCDate()).padStart(2, "0");

	return `${nextYear}-${nextMonth}-${nextDay}`;
}

export function getDateAvailabilityRange(
	startDate: string,
	endDate: string,
	timeZone: string
): Result<
	{ timeMax: string; timeMin: string },
	Exclude<SessionTimeParseError, { reason: "BOOKING_INVALID_DURATION" }>
> {
	return getUtcDateForZonedDateTime(nextCalendarDate(endDate), "00:00", timeZone).andThen(
		(timeMaxDate) =>
			getUtcDateForZonedDateTime(startDate, "00:00", timeZone).map((timeMinDate) => ({
				timeMax: timeMaxDate.toISOString(),
				timeMin: timeMinDate.toISOString()
			}))
	);
}
