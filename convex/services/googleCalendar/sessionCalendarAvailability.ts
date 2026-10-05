"use node";

import type { ActionCtx } from "#convex/_generated/server";
import {
	loadValidRescheduleLinkAndSession,
	type ValidRescheduleDetails
} from "#convex/lib/sessions/sessionCalendarActionBoundaries";
import {
	checkSessionMeetsAvailabilitySettings,
	getAvailableTimeOptions
} from "#convex/lib/sessions/sessionCalendarTime";
import {
	loadBookableRangeBusyWindowsFromGoogle,
	loadDayAvailableBookingTimes,
	loadDayBusyWindows,
	type GoogleCalendarAvailabilityError
} from "#convex/services/googleCalendar/sessionCalendarAvailabilityLoad";
import { getBookingSettingsService } from "#convex/services/booking/bookingSettings";
import type { RescheduleLinkLookupError } from "#convex/services/sessions/sessionReschedule";
import type { SessionAvailabilityValidationError } from "#convex/lib/sessions/sessionCalendarTime";
import type { BusyDayWindow as LibBusyDayWindow } from "#convex/lib/sessions/sessionCalendarTime";
import { checkGoogleCalendarAvailabilityRateLimit } from "#convex/lib/rateLimits";
import type { BookingAvailabilitySettings } from "#studio/lib/bookingAvailabilitySettings";

export type BusyDayWindow = LibBusyDayWindow;

export function enforceGoogleCalendarAvailabilityRateLimit(ctx: ActionCtx, rateLimitKey: string) {
	return checkGoogleCalendarAvailabilityRateLimit(ctx, rateLimitKey);
}

export type GetAvailableRescheduleTimesError =
	| RescheduleLinkLookupError
	| GoogleCalendarAvailabilityError
	| SessionAvailabilityValidationError;

export function loadBookableRangeBusyWindows(
	settings: Parameters<typeof loadBookableRangeBusyWindowsFromGoogle>[0]["settings"]
) {
	return loadBookableRangeBusyWindowsFromGoogle({ settings });
}

export function loadAvailableBookingTimesForDay(
	args: { date: string; duration: string },
	settings: Parameters<typeof loadDayAvailableBookingTimes>[0]["settings"]
) {
	return loadDayAvailableBookingTimes({ date: args.date, duration: args.duration, settings });
}

function pairRescheduleDetailsWithSettings(details: ValidRescheduleDetails) {
	return (settings: BookingAvailabilitySettings) => ({ details, settings });
}

function loadRescheduleBookingSettingsStep(ctx: ActionCtx) {
	return (details: ValidRescheduleDetails) =>
		getBookingSettingsService(ctx).map(pairRescheduleDetailsWithSettings(details));
}

export function loadRescheduleSessionAndBookingSettings(ctx: ActionCtx, token: string) {
	return loadValidRescheduleLinkAndSession(ctx, { now: Date.now(), token }).andThen(
		loadRescheduleBookingSettingsStep(ctx)
	);
}

export function loadRescheduleBookableRangeBusyWindows(
	settings: Parameters<typeof loadBookableRangeBusyWindowsFromGoogle>[0]["settings"],
	details: { session: { googleCalendarId?: string; googleEventId?: string } }
) {
	return loadBookableRangeBusyWindowsFromGoogle({
		ignoredEvent: {
			calendarId: details.session.googleCalendarId,
			eventId: details.session.googleEventId
		},
		settings
	});
}

function availableRescheduleTimesForDayStep(
	args: { date: string },
	details: { session: { duration: string; googleCalendarId?: string; googleEventId?: string } },
	settings: BookingAvailabilitySettings
) {
	return ({
		busyWindows,
		timeZone
	}: {
		busyWindows: Parameters<typeof getAvailableTimeOptions>[0]["busyWindows"];
		timeZone: string;
	}) => {
		const calendarAvailableTimes = getAvailableTimeOptions({
			busyWindows,
			date: args.date,
			duration: details.session.duration,
			eventBufferMinutes: settings.eventBufferMinutes,
			timeZone
		});

		const now = Date.now();

		const times = calendarAvailableTimes.filter((time) =>
			checkSessionMeetsAvailabilitySettings({
				date: args.date,
				duration: details.session.duration,
				now,
				settings,
				time,
				timeZone
			}).isOk()
		);

		return { timeZone, times };
	};
}

export function loadAvailableRescheduleTimesForDay(
	args: { date: string },
	details: { session: { duration: string; googleCalendarId?: string; googleEventId?: string } },
	settings: BookingAvailabilitySettings
) {
	return loadDayBusyWindows({
		date: args.date,
		ignoredEvent: {
			calendarId: details.session.googleCalendarId,
			eventId: details.session.googleEventId
		}
	}).map(availableRescheduleTimesForDayStep(args, details, settings));
}
