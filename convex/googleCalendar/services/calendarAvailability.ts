"use node";

import type { ActionCtx } from "#convex/_generated/server";
import { availableRescheduleTimesForDay } from "#convex/googleCalendar/lib/calendarAvailability";
import {
	loadValidRescheduleLinkAndSession,
	type ValidRescheduleDetails
} from "#convex/sessions/lib/calendarActionBoundaries";
import type { BusyDayWindow as LibBusyDayWindow } from "#convex/sessions/lib/calendarTime";
import {
	loadBookableRangeBusyWindowsFromGoogle,
	loadDayAvailableBookingTimes,
	loadDayBusyWindows,
	type GoogleCalendarAvailabilityError
} from "#convex/googleCalendar/services/calendarAvailabilityLoad";
import { getBookingSettingsService } from "#convex/booking/services/settings";
import type { RescheduleLinkLookupError } from "#convex/sessions/lib/rescheduleLinks";
import type { SessionAvailabilityValidationError } from "#convex/sessions/lib/calendarTime";
import { checkSessionMeetsAvailabilitySettings } from "#convex/sessions/services/calendarTime";
import type { BookingAvailabilitySettings } from "#studio/lib/bookingAvailabilitySettings";

export type BusyDayWindow = LibBusyDayWindow;

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
	return loadDayAvailableBookingTimes({ ...args, settings });
}

function loadRescheduleBookingSettings(ctx: ActionCtx, details: ValidRescheduleDetails) {
	return getBookingSettingsService(ctx).map((settings: BookingAvailabilitySettings) => ({
		details,
		settings
	}));
}

export function loadRescheduleSessionAndBookingSettings(ctx: ActionCtx, token: string) {
	return loadValidRescheduleLinkAndSession(ctx, { now: Date.now(), token }).andThen(
		(details: ValidRescheduleDetails) => loadRescheduleBookingSettings(ctx, details)
	);
}

export function loadRescheduleBookableRangeBusyWindows(
	settings: Parameters<typeof loadBookableRangeBusyWindowsFromGoogle>[0]["settings"],
	details: { session: { googleCalendarId?: string; googleEventId?: string } }
) {
	return loadBookableRangeBusyWindowsFromGoogle({
		settings,
		ignoredEvent: {
			calendarId: details.session.googleCalendarId,
			eventId: details.session.googleEventId
		}
	});
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
	}).map((busyWindowsAndZone) =>
		availableRescheduleTimesForDay(
			args,
			details,
			settings,
			busyWindowsAndZone,
			checkSessionMeetsAvailabilitySettings
		)
	);
}
