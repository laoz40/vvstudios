"use node";

import type { ActionCtx } from "#convex/_generated/server";
import {
	loadValidRescheduleLinkAndSession,
	type ValidRescheduleDetails
} from "#convex/sessions/lib/sessionCalendarActionBoundaries";
import {
	checkSessionMeetsAvailabilitySettings,
	getAvailableTimeOptions
} from "#convex/sessions/lib/sessionCalendarTime";
import {
	loadBookableRangeBusyWindowsFromGoogle,
	loadDayAvailableBookingTimes,
	loadDayBusyWindows,
	type GoogleCalendarAvailabilityError
} from "#convex/googleCalendar/services/sessionCalendarAvailabilityLoad";
import { getBookingSettingsService } from "#convex/booking/services/bookingSettings";
import type { RescheduleLinkLookupError } from "#convex/sessions/lib/sessionRescheduleLinks";
import type { SessionAvailabilityValidationError } from "#convex/sessions/lib/sessionCalendarTime";
import type { BusyDayWindow as LibBusyDayWindow } from "#convex/sessions/lib/sessionCalendarTime";
import { checkGoogleCalendarAvailabilityRateLimit } from "#convex/shared/lib/rateLimits";
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

function pairRescheduleDetailsWithSettings(
	details: ValidRescheduleDetails,
	settings: BookingAvailabilitySettings
) {
	return { details, settings };
}

function loadRescheduleBookingSettingsStep(ctx: ActionCtx, details: ValidRescheduleDetails) {
	return getBookingSettingsService(ctx).map((settings: BookingAvailabilitySettings) =>
		pairRescheduleDetailsWithSettings(details, settings)
	);
}

export function loadRescheduleSessionAndBookingSettings(ctx: ActionCtx, token: string) {
	return loadValidRescheduleLinkAndSession(ctx, { now: Date.now(), token }).andThen(
		(details: ValidRescheduleDetails) => loadRescheduleBookingSettingsStep(ctx, details)
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
	settings: BookingAvailabilitySettings,

	{
		busyWindows,
		timeZone
	}: { busyWindows: Parameters<typeof getAvailableTimeOptions>[0]["busyWindows"]; timeZone: string }
) {
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
	}).map((_value) => availableRescheduleTimesForDayStep(args, details, settings, _value));
}
