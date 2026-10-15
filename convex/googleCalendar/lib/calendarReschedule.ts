import type { Doc } from "#convex/_generated/dataModel";
import { errAsync, okAsync } from "neverthrow";
import type { getGoogleCalendarClient } from "#convex/googleCalendar/lib/googleCalendarClient";
import type { SessionAvailabilitySettings } from "#convex/sessions/lib/calendarTime";
import type { SaveClientSessionRescheduleArgs } from "#convex/sessions/lib/schedulingArgs";
import { pickBookingAddonQuantities } from "#/domain/booking/addon-quantities";
import { logError } from "#convex/shared/lib/logger";

export function resolveRescheduleReservation(
	details: { link: Doc<"bookingRescheduleLinks">; session: Doc<"bookings"> },
	lockedAt: number,
	settings: SessionAvailabilitySettings,
	reservationResult:
		| {
				outcome: "reserved";
				reservation: { reservedAt: number; sessionStartAt: number; duration: string };
		  }
		| { outcome: "unavailable" }
) {
	return reservationResult.outcome === "unavailable"
		? errAsync({ reason: "BOOKING_TIME_UNAVAILABLE" as const })
		: okAsync({
				link: details.link,
				lockedAt,
				reservation: reservationResult.reservation,
				session: details.session,
				settings
			});
}

export function logRescheduleUnlockFailureResult(
	linkId: Doc<"bookingRescheduleLinks">["_id"],
	error: { reason: string }
) {
	logError({ operation: "googleCalendar.reschedule.unlockLink", reason: error.reason, linkId });

	return okAsync(null);
}

export function logRescheduleReservationCleanupFailureResult(
	bookingId: Doc<"bookings">["_id"],
	error: { reason: string }
) {
	logError({
		operation: "googleCalendar.reschedule.cleanupReservation",
		reason: error.reason,
		bookingId
	});

	return okAsync(null);
}

export function buildRescheduleCalendarTimingArgs(
	state: { session: Doc<"bookings"> },
	calendarClient: ReturnType<typeof getGoogleCalendarClient>,
	args: { date: string; time: string },
	settings: SessionAvailabilitySettings
) {
	const session = state.session;

	return {
		session,
		client: calendarClient,
		date: args.date,
		details: {
			addons: session.addons,
			duration: session.duration,
			email: session.email,
			name: session.name,
			service: session.service,
			...pickBookingAddonQuantities(session)
		},
		duration: session.duration,
		createMissingEvent: session.status === "failed",
		settings,
		time: args.time
	};
}

export function buildSaveClientSessionRescheduleArgs(
	state: {
		session: Doc<"bookings">;
		reservation: { reservedAt: number; sessionStartAt: number; duration: string };
		timingUpdate: { sessionStartAt: number; googleCalendarId?: string; googleEventId?: string };
	},
	args: { date: string; time: string }
): SaveClientSessionRescheduleArgs {
	const saveArgs: SaveClientSessionRescheduleArgs = {
		bookingId: state.session._id,
		date: args.date,
		time: args.time,
		sessionStartAt: state.timingUpdate.sessionStartAt,
		confirmBooking: state.session.status === "failed",
		reservation: state.reservation
	};

	if (state.timingUpdate.googleCalendarId) {
		saveArgs.googleCalendarId = state.timingUpdate.googleCalendarId;
	}

	if (state.timingUpdate.googleEventId) {
		saveArgs.googleEventId = state.timingUpdate.googleEventId;
	}

	return saveArgs;
}

export function updatedRescheduledBooking(
	session: Doc<"bookings">,
	args: { date: string; time: string },
	timingUpdate: { sessionStartAt: number; googleCalendarId?: string; googleEventId?: string }
) {
	return {
		...session,
		date: args.date,
		time: args.time,
		sessionStartAt: timingUpdate.sessionStartAt,
		googleCalendarId: timingUpdate.googleCalendarId ?? session.googleCalendarId,
		googleEventId: timingUpdate.googleEventId ?? session.googleEventId
	};
}
