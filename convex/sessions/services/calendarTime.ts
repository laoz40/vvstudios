import { ok, safeTry } from "neverthrow";
import {
	getUtcDateForZonedDateTime,
	parseDateValue,
	parseDurationMinutes,
	validateAvailabilityDateRange,
	validateAvailabilityDay,
	validateAvailabilityLeadTime,
	type SessionAvailabilityArgs
} from "#convex/sessions/lib/calendarTime";

function parseAvailabilityDuration(
	args: SessionAvailabilityArgs,
	daySchedule: { endTime: string; startTime: string }
) {
	return parseDurationMinutes(args.duration).map((durationMinutes) => ({
		args,
		daySchedule,
		durationMinutes
	}));
}

export function checkSessionMeetsAvailabilitySettings(args: SessionAvailabilityArgs) {
	return safeTry(function* () {
		const bookingDate = yield* parseDateValue(args.date);
		const daySchedule = yield* validateAvailabilityDateRange(args, bookingDate);
		const availability = yield* parseAvailabilityDuration(args, daySchedule);
		yield* validateAvailabilityDay(availability);
		const bookingStart = yield* getUtcDateForZonedDateTime(args.date, args.time, args.timeZone);

		return ok(yield* validateAvailabilityLeadTime(args, bookingStart));
	});
}
