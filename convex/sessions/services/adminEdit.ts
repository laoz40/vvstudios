import { ok, Result, ResultAsync, safeTry } from "neverthrow";
import { isTimeSlotAvailable } from "#convex/sessions/lib/calendarTime";
import { checkSessionMeetsAvailabilitySettings } from "#convex/sessions/services/calendarTime";
import {
	selectChangedSessionTimingEdits,
	selectAvailableSessionSchedulingChecks,
	selectSessionTimingEditsRequiringSettingsValidation,
	sessionTimingAvailabilityResult,
	type AdminSessionUpdateError,
	type ValidateSessionTimingEditArgs,
	type SessionSchedulingAvailabilityArgs
} from "#convex/sessions/lib/adminEdit";
import { getBusyWindows } from "#convex/googleCalendar/lib/googleCalendarAvailability";
import { tryGoogleCalendarAvailability } from "#convex/googleCalendar/lib/googleCalendarErrors";

function loadBusyWindowsForSessionTimingEdit(args: ValidateSessionTimingEditArgs) {
	return tryGoogleCalendarAvailability(() =>
		getBusyWindows({
			calendar: args.calendar,
			calendarIds: args.calendarIds,
			date: args.next.date,
			ignoredEvent: {
				calendarId: args.existing.googleCalendarId,
				eventId: args.existing.googleEventId
			},
			timeZone: args.timeZone
		}).then((busyWindows) =>
			isTimeSlotAvailable({
				busyWindows,
				date: args.next.date,
				duration: args.next.duration,
				eventBufferMinutes: args.settings.eventBufferMinutes,
				time: args.next.time,
				timeZone: args.timeZone
			})
		)
	);
}

function loadAvailableBusyWindowsForSessionTimingEdit(args: ValidateSessionTimingEditArgs) {
	return safeTry(async function* () {
		const availability = yield* loadBusyWindowsForSessionTimingEdit(args);

		return ok(yield* sessionTimingAvailabilityResult(availability));
	});
}

function validateChangedSessionTiming(args: ValidateSessionTimingEditArgs) {
	const settingsValidation: Result<null[], AdminSessionUpdateError> = Result.combine(
		selectSessionTimingEditsRequiringSettingsValidation(args).map((eligibleArgs) =>
			checkSessionMeetsAvailabilitySettings({
				date: eligibleArgs.next.date,
				duration: eligibleArgs.next.duration,
				settings: eligibleArgs.settings,
				time: eligibleArgs.next.time,
				timeZone: eligibleArgs.timeZone
			})
		)
	);

	return safeTry(async function* () {
		yield* settingsValidation;

		return ok(yield* loadAvailableBusyWindowsForSessionTimingEdit(args));
	});
}

export function validateSessionTimingEdit(args: ValidateSessionTimingEditArgs) {
	return ResultAsync.combine(
		selectChangedSessionTimingEdits(args).map(validateChangedSessionTiming)
	).map(() => null);
}

export function verifySessionCanBeScheduled(args: SessionSchedulingAvailabilityArgs) {
	const { session, settings, timeZone } = args;

	return safeTry(async function* () {
		const available = yield* checkSessionMeetsAvailabilitySettings({
			date: session.date,
			duration: session.duration,
			settings,
			time: session.time,
			timeZone
		})
			.map(() => selectAvailableSessionSchedulingChecks(true, args))
			.orElse(() => ok([]));

		const results = yield* ResultAsync.combine(
			available.map((eligibleArgs) =>
				tryGoogleCalendarAvailability(() =>
					getBusyWindows({
						calendar: eligibleArgs.calendar,
						calendarIds: eligibleArgs.calendarIds,
						date: eligibleArgs.session.date,
						timeZone: eligibleArgs.timeZone
					})
				).map((busyWindows) =>
					isTimeSlotAvailable({
						busyWindows,
						date: eligibleArgs.session.date,
						duration: eligibleArgs.session.duration,
						eventBufferMinutes: eligibleArgs.settings.eventBufferMinutes,
						time: eligibleArgs.session.time,
						timeZone: eligibleArgs.timeZone
					})
				)
			)
		);

		return ok(results[0] ?? false);
	});
}
