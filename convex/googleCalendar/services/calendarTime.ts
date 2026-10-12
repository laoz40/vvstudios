import { ok, safeTry, type Result } from "neverthrow";
import {
	getDateAvailabilityEndDateTime,
	mapDateAvailabilityRangeFromStartStep,
	type SessionTimeParseError
} from "#convex/sessions/lib/calendarTime";

export function getDateAvailabilityRange(
	startDate: string,
	endDate: string,
	timeZone: string
): Result<
	{ timeMax: string; timeMin: string },
	Exclude<SessionTimeParseError, { reason: "BOOKING_INVALID_DURATION" }>
> {
	return safeTry(function* () {
		const timeMaxDate = yield* getDateAvailabilityEndDateTime(endDate, timeZone);
		const range = yield* mapDateAvailabilityRangeFromStartStep(startDate, timeZone, timeMaxDate);

		return ok(range);
	});
}
