import { err, ok } from "neverthrow";
import { getBusyWindows } from "#convex/googleCalendar/lib/googleCalendarAvailability";
import { tryGoogleCalendarAvailability } from "#convex/googleCalendar/lib/googleCalendarErrors";
import type { PackageCalendarDetails } from "#convex/googleCalendar/lib/packageDetails";
import type { getGoogleCalendarClient } from "#convex/googleCalendar/lib/googleCalendarClient";
import type { SessionCalendarEventRecord } from "#convex/sessions/lib/calendarEventPayload";
import { isTimeSlotAvailable } from "#convex/sessions/lib/calendarTime";
import { pickBookingAddonQuantities } from "#/domain/booking/addon-quantities";

type PackageCalendarClient = Pick<
	ReturnType<typeof getGoogleCalendarClient>,
	"calendar" | "calendarId" | "calendarIds" | "timeZone"
>;

export type PackageCalendarIdPatch = Pick<
	SessionCalendarEventRecord,
	"googleCalendarId" | "googleEventId"
>;

export function packageCalendarIdPatchFromUpdate(
	session: SessionCalendarEventRecord | null,
	result: { googleCalendarId?: string; googleEventId?: string }
) {
	const googleCalendarId = result.googleCalendarId ?? session?.googleCalendarId;
	const googleEventId = result.googleEventId ?? session?.googleEventId;
	const patch: PackageCalendarIdPatch = {};

	if (googleCalendarId) patch.googleCalendarId = googleCalendarId;

	if (googleEventId) patch.googleEventId = googleEventId;

	return patch;
}

export function packageCalendarEventDetails(details: PackageCalendarDetails) {
	return {
		addons: details.addons,
		duration: details.duration,
		email: details.email,
		name: details.name,
		service: details.service,
		...pickBookingAddonQuantities(details)
	};
}

export function loadPackageBusyWindows(
	client: PackageCalendarClient,
	details: PackageCalendarDetails,
	session: SessionCalendarEventRecord | null
) {
	return tryGoogleCalendarAvailability(() =>
		getBusyWindows({
			calendar: client.calendar,
			calendarIds: client.calendarIds,
			date: details.date,
			ignoredEvent: session
				? { calendarId: session.googleCalendarId, eventId: session.googleEventId }
				: undefined,
			timeZone: client.timeZone
		})
	);
}

export function packageSlotAvailabilityResult(
	client: PackageCalendarClient,
	details: PackageCalendarDetails,
	busyWindows: Awaited<ReturnType<typeof getBusyWindows>>
) {
	const isAvailable = isTimeSlotAvailable({
		busyWindows,
		date: details.date,
		duration: details.duration,
		eventBufferMinutes: details.eventBufferMinutes,
		time: details.time,
		timeZone: client.timeZone
	});

	return isAvailable ? ok(client) : err({ reason: "BOOKING_TIME_UNAVAILABLE" as const });
}
