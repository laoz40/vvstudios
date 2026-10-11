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
	return parseDateValue(args.date)
		.andThen((bookingDate) => validateAvailabilityDateRange(args, bookingDate))
		.andThen((daySchedule) => parseAvailabilityDuration(args, daySchedule))
		.andThen(validateAvailabilityDay)
		.andThen(() => getUtcDateForZonedDateTime(args.date, args.time, args.timeZone))
		.andThen((bookingStart) => validateAvailabilityLeadTime(args, bookingStart));
}
