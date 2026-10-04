"use node";

import { err, ok, okAsync, type Result, type ResultAsync } from "neverthrow";
import type { Doc } from "#convex/_generated/dataModel";
import type { ActionCtx } from "#convex/_generated/server";
import {
	loadBookingAvailabilitySettings,
	reserveClaimedBookingSession
} from "#convex/lib/booking/bookingConfirmationActionBoundaries";
import {
	saveConfirmedBooking,
	sendConfirmedBookingInvoice
} from "#convex/lib/booking/bookingConfirmation";
import { getGoogleCalendarClient } from "#convex/lib/googleCalendar/googleCalendarClient";
import { calendarResultAsync } from "#convex/lib/googleCalendar/googleCalendarErrors";
import { buildSessionCalendarEventPayload } from "#convex/lib/sessions/sessionCalendarEvents";
import { pickBookingAddonQuantities } from "#studio/features/booking-form/lib/booking-form-model";
import type { SessionAvailabilitySettings } from "#convex/lib/sessions/sessionCalendarTime";
import {
	failBookingConfirmation,
	verifySessionCanBeScheduled
} from "#convex/lib/sessions/sessionAdminEdit";
import type { CompleteClaimedSessionSuccess } from "#convex/services/booking/bookingConfirmation";

export type CompleteClaimedSessionError =
	| { reason: "BOOKING_NOT_FOUND" }
	| { reason: "BOOKING_CONFIRMATION_NOT_CLAIMED" }
	| { reason: "BOOKING_RESERVATION_MISMATCH" }
	| { reason: "GOOGLE_CALENDAR_AUTH_FAILED" }
	| { reason: "GOOGLE_CALENDAR_AVAILABILITY_FAILED" }
	| { reason: "GOOGLE_CALENDAR_RATE_LIMITED" };

export function requireBookingConfirmationClaimed(
	session: Doc<"bookings">
): Result<Doc<"bookings">, { reason: "BOOKING_CONFIRMATION_NOT_CLAIMED" }> {
	return session.bookingConfirmationClaimedAt
		? ok(session)
		: err({ reason: "BOOKING_CONFIRMATION_NOT_CLAIMED" as const });
}

export function alreadyCompletedClaimedSessionOutcome(
	session: Doc<"bookings">
): CompleteClaimedSessionSuccess | null {
	if (session.status === "confirmed" || session.status === "email_failed") {
		return { outcome: "already_completed" };
	}

	return null;
}

export function finishIncompleteClaimedSession(
	ctx: ActionCtx,
	session: Doc<"bookings">
): ResultAsync<CompleteClaimedSessionSuccess, CompleteClaimedSessionError> {
	return loadBookingAvailabilitySettings(ctx).andThen((settings) =>
		completeClaimedBookingSession(ctx, session, settings)
	);
}

export function completeClaimedBookingSession(
	ctx: ActionCtx,
	session: Doc<"bookings">,
	settings: SessionAvailabilitySettings
): ResultAsync<CompleteClaimedSessionSuccess, CompleteClaimedSessionError> {
	const calendarClient = getGoogleCalendarClient();

	return verifySessionCanBeScheduled({
		session,
		calendar: calendarClient.calendar,
		calendarIds: calendarClient.calendarIds,
		settings,
		timeZone: calendarClient.timeZone
	}).andThen((canBeScheduled) => {
		if (!canBeScheduled) {
			return failBookingConfirmation(ctx, session._id, "BOOKING_TIME_UNAVAILABLE").map(() => ({
				outcome: "booking_time_unavailable" as const
			}));
		}

		return reserveClaimedBookingSession(ctx, {
			bookingId: session._id,
			duration: session.duration,
			eventBufferMinutes: settings.eventBufferMinutes,
			sessionStartAt: session.sessionStartAt
		}).andThen((reservationResult) => {
			if (reservationResult.outcome === "unavailable") {
				return failBookingConfirmation(ctx, session._id, "BOOKING_TIME_UNAVAILABLE").map(() => ({
					outcome: "booking_time_unavailable" as const
				}));
			}

			const reservation = reservationResult.reservation;

			const payloadResult = buildSessionCalendarEventPayload({
				date: session.date,
				time: session.time,
				timeZone: calendarClient.timeZone,
				details: {
					addons: session.addons,
					name: session.name,
					duration: session.duration,
					email: session.email,
					service: session.service,
					...pickBookingAddonQuantities(session)
				}
			});

			if (payloadResult.isErr()) {
				return failBookingConfirmation(ctx, session._id, "BOOKING_INVALID_INPUT", reservation).map(
					() => ({ outcome: "booking_invalid_input" as const })
				);
			}

			return calendarResultAsync(
				calendarClient.calendar.events.insert({
					calendarId: calendarClient.calendarId,
					sendUpdates: "all",
					requestBody: payloadResult.value
				}),
				"GOOGLE_CALENDAR_CREATE_FAILED"
			)
				.andThen((createdEvent) => {
					const googleEventId = createdEvent.data.id ?? undefined;

					return saveConfirmedBooking(
						ctx,
						session,
						calendarClient,
						reservation,
						googleEventId
					).andThen((completionSaved) => {
						if (!completionSaved) {
							return okAsync({ outcome: "reservation_lost" as const });
						}

						return sendConfirmedBookingInvoice(ctx, session, settings).map(() => ({
							outcome: "completed" as const
						}));
					});
				})
				.orElse(() =>
					failBookingConfirmation(
						ctx,
						session._id,
						"GOOGLE_CALENDAR_CREATE_FAILED",
						reservation
					).map(() => ({ outcome: "google_calendar_create_failed" as const }))
				);
		});
	});
}
