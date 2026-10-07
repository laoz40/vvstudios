import type { Result } from "neverthrow";
import {
	getDateAvailabilityEndDateTime,
	mapDateAvailabilityRangeFromStartStep,
	type SessionTimeParseError
} from "#convex/lib/sessions/sessionCalendarTime";

export function getDateAvailabilityRange(
	startDate: string,
	endDate: string,
	timeZone: string
): Result<
	{ timeMax: string; timeMin: string },
	Exclude<SessionTimeParseError, { reason: "BOOKING_INVALID_DURATION" }>
> {
	return getDateAvailabilityEndDateTime(endDate, timeZone).andThen((timeMaxDate) =>
		mapDateAvailabilityRangeFromStartStep(startDate, timeZone, timeMaxDate)
	);
}
