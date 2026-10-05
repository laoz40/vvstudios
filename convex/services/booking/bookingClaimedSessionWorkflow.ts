"use node";

import { err, ok, okAsync, type Result, type ResultAsync } from "neverthrow";
import type { Doc, Id } from "#convex/_generated/dataModel";
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
import {
	calendarErrorSchema,
	mapCalendarErrorCode
} from "#convex/lib/googleCalendar/googleCalendarErrors";
import { tryPromise } from "#convex/lib/result";
import { buildSessionCalendarEventPayload } from "#convex/lib/sessions/sessionCalendarEventPayload";
import { pickBookingAddonQuantities } from "#studio/features/booking-form/lib/booking-form-model";
import type { SessionAvailabilitySettings } from "#convex/lib/sessions/sessionCalendarTime";
import {
	failBookingConfirmation,
	verifySessionCanBeScheduled
} from "#convex/lib/sessions/sessionAdminEdit";
import type { SessionReservation } from "#convex/lib/sessions/sessionReservations";
import { getSessionFromQuery } from "#convex/lib/sessions/sessionLookup";
import type { CompleteClaimedSessionSuccess } from "#convex/services/booking/bookingConfirmation";

export type CompleteClaimedSessionError =
	| { reason: "BOOKING_NOT_FOUND" }
	| { reason: "BOOKING_CONFIRMATION_NOT_CLAIMED" }
	| { reason: "BOOKING_RESERVATION_MISMATCH" }
	| { reason: "GOOGLE_CALENDAR_AUTH_FAILED" }
	| { reason: "GOOGLE_CALENDAR_AVAILABILITY_FAILED" }
	| { reason: "GOOGLE_CALENDAR_RATE_LIMITED" };

type GoogleCalendarClient = ReturnType<typeof getGoogleCalendarClient>;

type ClaimedSessionStepDone = { kind: "done"; outcome: CompleteClaimedSessionSuccess };

type VerifyClaimedBookingScheduleResult = { kind: "schedulable" } | ClaimedSessionStepDone;

type ReserveClaimedBookingSlotResult =
	| { kind: "reserved"; reservation: SessionReservation }
	| ClaimedSessionStepDone;

type InsertClaimedBookingCalendarEventResult =
	| { kind: "created"; googleEventId: string | undefined }
	| ClaimedSessionStepDone;

function requireClaimed(
	session: Doc<"bookings">
): Result<Doc<"bookings">, { reason: "BOOKING_CONFIRMATION_NOT_CLAIMED" }> {
	return session.bookingConfirmationClaimedAt
		? ok(session)
		: err({ reason: "BOOKING_CONFIRMATION_NOT_CLAIMED" as const });
}

export function alreadyCompleted(session: Doc<"bookings">): CompleteClaimedSessionSuccess | null {
	if (session.status === "confirmed" || session.status === "email_failed") {
		return { outcome: "already_completed" };
	}

	return null;
}

export type LoadedClaimedSession =
	| { kind: "done"; outcome: CompleteClaimedSessionSuccess }
	| { kind: "pending"; session: Doc<"bookings"> };

export function loadClaimedSession(
	ctx: ActionCtx,
	bookingId: Id<"bookings">
): ResultAsync<
	LoadedClaimedSession,
	CompleteClaimedSessionError | { reason: "BOOKING_NOT_FOUND" }
> {
	return getSessionFromQuery(ctx, bookingId)
		.andThen(requireClaimed)
		.andThen((session) => {
			const completed = alreadyCompleted(session);

			return completed
				? okAsync({ kind: "done" as const, outcome: completed })
				: okAsync({ kind: "pending" as const, session });
		});
}

export function runCompletion(
	ctx: ActionCtx,
	session: Doc<"bookings">
): ResultAsync<CompleteClaimedSessionSuccess, CompleteClaimedSessionError> {
	return loadBookingAvailabilitySettings(ctx).andThen((settings) =>
		completeClaimed(ctx, session, settings)
	);
}

function completeClaimed(
	ctx: ActionCtx,
	session: Doc<"bookings">,
	settings: SessionAvailabilitySettings
): ResultAsync<CompleteClaimedSessionSuccess, CompleteClaimedSessionError> {
	const calendarClient = getGoogleCalendarClient();

	return verifySchedule(ctx, session, settings, calendarClient).andThen((schedule) => {
		if (schedule.kind === "done") {
			return okAsync(schedule.outcome);
		}

		return reserveSlot(ctx, session, settings).andThen((hold) => {
			if (hold.kind === "done") {
				return okAsync(hold.outcome);
			}

			return insertCalendarEvent(ctx, session, calendarClient, hold.reservation).andThen(
				(calendar) => {
					if (calendar.kind === "done") {
						return okAsync(calendar.outcome);
					}

					return saveConfirmedClaimedBookingAndInvoice(
						ctx,
						session,
						settings,
						calendarClient,
						hold.reservation,
						calendar.googleEventId
					);
				}
			);
		});
	});
}

function markClaimedBookingTimeUnavailable(ctx: ActionCtx, bookingId: Id<"bookings">) {
	return failBookingConfirmation(ctx, bookingId, "BOOKING_TIME_UNAVAILABLE").map(() => ({
		outcome: "booking_time_unavailable" as const
	}));
}

function verifySchedule(
	ctx: ActionCtx,
	session: Doc<"bookings">,
	settings: SessionAvailabilitySettings,
	calendarClient: GoogleCalendarClient
): ResultAsync<VerifyClaimedBookingScheduleResult, CompleteClaimedSessionError> {
	return verifySessionCanBeScheduled({
		session,
		calendar: calendarClient.calendar,
		calendarIds: calendarClient.calendarIds,
		settings,
		timeZone: calendarClient.timeZone
	}).andThen((canBeScheduled) => {
		if (!canBeScheduled) {
			return markClaimedBookingTimeUnavailable(ctx, session._id).map((outcome) => ({
				kind: "done" as const,
				outcome
			}));
		}

		return okAsync({ kind: "schedulable" as const });
	});
}

function reserveSlot(
	ctx: ActionCtx,
	session: Doc<"bookings">,
	settings: SessionAvailabilitySettings
): ResultAsync<ReserveClaimedBookingSlotResult, CompleteClaimedSessionError> {
	return reserveClaimedBookingSession(ctx, {
		bookingId: session._id,
		duration: session.duration,
		eventBufferMinutes: settings.eventBufferMinutes,
		sessionStartAt: session.sessionStartAt
	}).andThen((reservationResult) => {
		if (reservationResult.outcome === "unavailable") {
			return markClaimedBookingTimeUnavailable(ctx, session._id).map((outcome) => ({
				kind: "done" as const,
				outcome
			}));
		}

		return okAsync({ kind: "reserved" as const, reservation: reservationResult.reservation });
	});
}

function buildClaimedBookingCalendarPayload(session: Doc<"bookings">, timeZone: string) {
	return buildSessionCalendarEventPayload({
		date: session.date,
		time: session.time,
		timeZone,
		details: {
			addons: session.addons,
			name: session.name,
			duration: session.duration,
			email: session.email,
			service: session.service,
			...pickBookingAddonQuantities(session)
		}
	});
}

function insertCalendarEvent(
	ctx: ActionCtx,
	session: Doc<"bookings">,
	calendarClient: GoogleCalendarClient,
	reservation: SessionReservation
): ResultAsync<InsertClaimedBookingCalendarEventResult, CompleteClaimedSessionError> {
	const payloadResult = buildClaimedBookingCalendarPayload(session, calendarClient.timeZone);

	if (payloadResult.isErr()) {
		return failBookingConfirmation(ctx, session._id, "BOOKING_INVALID_INPUT", reservation).map(
			() => ({ kind: "done" as const, outcome: { outcome: "booking_invalid_input" as const } })
		);
	}

	return tryPromise({
		try: () =>
			calendarClient.calendar.events.insert({
				calendarId: calendarClient.calendarId,
				sendUpdates: "all",
				requestBody: payloadResult.value
			}),
		catch: (error) => {
			const parsedError = calendarErrorSchema.safeParse(error);

			return {
				reason: parsedError.success
					? mapCalendarErrorCode(parsedError.data, "GOOGLE_CALENDAR_CREATE_FAILED")
					: "GOOGLE_CALENDAR_CREATE_FAILED"
			};
		}
	})
		.map((createdEvent) => ({
			kind: "created" as const,
			googleEventId: createdEvent.data.id ?? undefined
		}))
		.orElse(() =>
			failBookingConfirmation(ctx, session._id, "GOOGLE_CALENDAR_CREATE_FAILED", reservation).map(
				() => ({
					kind: "done" as const,
					outcome: { outcome: "google_calendar_create_failed" as const }
				})
			)
		);
}

function saveConfirmedClaimedBookingAndInvoice(
	ctx: ActionCtx,
	session: Doc<"bookings">,
	settings: SessionAvailabilitySettings,
	calendarClient: GoogleCalendarClient,
	reservation: SessionReservation,
	googleEventId: string | undefined
): ResultAsync<CompleteClaimedSessionSuccess, CompleteClaimedSessionError> {
	return saveConfirmedBooking(ctx, session, calendarClient, reservation, googleEventId).andThen(
		(completionSaved) => {
			if (!completionSaved) {
				return okAsync({ outcome: "reservation_lost" as const });
			}

			return sendConfirmedBookingInvoice(ctx, session, settings).map(() => ({
				outcome: "completed" as const
			}));
		}
	);
}
