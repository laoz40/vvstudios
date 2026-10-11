"use node";

import type { calendar_v3 } from "googleapis/build/src/apis/calendar/v3";

import { err, ok, okAsync, type Result, type ResultAsync } from "neverthrow";

import type { Doc, Id } from "#convex/_generated/dataModel";
import type { ActionCtx } from "#convex/_generated/server";
import { type ReserveClaimedBookingSessionResult } from "#convex/booking/lib/confirmationActionBoundaries";

import { getGoogleCalendarClient } from "#convex/googleCalendar/lib/googleCalendarClient";
import {
	calendarErrorSchema,
	mapCalendarErrorCode
} from "#convex/googleCalendar/lib/googleCalendarErrors";
import { tryPromise } from "#convex/shared/lib/result";
import { buildSessionCalendarEventPayload } from "#convex/sessions/lib/calendarEventPayload";
import { pickBookingAddonQuantities } from "#/domain/booking/addon-quantities";
import { failBookingConfirmation } from "#convex/sessions/lib/adminEdit";

import type { SessionReservation } from "#convex/sessions/lib/reservations";

import type { CompleteClaimedSessionSuccess } from "#convex/booking/services/confirmation";

export type CompleteClaimedSessionError =
	| { reason: "BOOKING_NOT_FOUND" }
	| { reason: "BOOKING_CONFIRMATION_NOT_CLAIMED" }
	| { reason: "BOOKING_RESERVATION_MISMATCH" }
	| { reason: "GOOGLE_CALENDAR_AUTH_FAILED" }
	| { reason: "GOOGLE_CALENDAR_AVAILABILITY_FAILED" }
	| { reason: "GOOGLE_CALENDAR_RATE_LIMITED" };

export type GoogleCalendarClient = ReturnType<typeof getGoogleCalendarClient>;

type ClaimedSessionStepDone = { kind: "done"; outcome: CompleteClaimedSessionSuccess };

export type VerifyClaimedBookingScheduleResult = { kind: "schedulable" } | ClaimedSessionStepDone;

export type ReserveClaimedBookingSlotResult =
	| { kind: "reserved"; reservation: SessionReservation }
	| ClaimedSessionStepDone;

export type InsertClaimedBookingCalendarEventResult =
	| { kind: "created"; googleEventId: string | undefined }
	| ClaimedSessionStepDone;

export type LoadedClaimedSession =
	| { kind: "done"; outcome: CompleteClaimedSessionSuccess }
	| { kind: "pending"; session: Doc<"bookings"> };

type PreparedClaimedCalendarEvent =
	| { kind: "ready"; body: calendar_v3.Schema$Event }
	| ClaimedSessionStepDone;

export function selectPendingClaimedSessions(loaded: LoadedClaimedSession) {
	return loaded.kind === "pending" ? [loaded.session] : [];
}

export function selectSchedulableClaimedSessions(
	schedule: VerifyClaimedBookingScheduleResult,
	session: Doc<"bookings">
) {
	return schedule.kind === "schedulable" ? [session] : [];
}

export function selectClaimedBookingReservations(hold: ReserveClaimedBookingSlotResult) {
	return hold.kind === "reserved" ? [hold.reservation] : [];
}

export function selectCreatedClaimedCalendarEvents(
	calendar: InsertClaimedBookingCalendarEventResult
) {
	return calendar.kind === "created" ? [calendar] : [];
}

export function selectConfirmedClaimedBookings(saved: boolean, session: Doc<"bookings">) {
	return saved ? [session] : [];
}

export function resolveClaimedSessionCompletion(
	decision:
		| LoadedClaimedSession
		| VerifyClaimedBookingScheduleResult
		| ReserveClaimedBookingSlotResult
		| InsertClaimedBookingCalendarEventResult,
	completions: CompleteClaimedSessionSuccess[]
): CompleteClaimedSessionSuccess {
	if (decision.kind === "done") return decision.outcome;

	const [completion] = completions;

	if (completion === undefined)
		throw new Error("Pending claimed booking did not produce a completion");

	return completion;
}

export function prepareClaimedCalendarEvent(
	ctx: ActionCtx,
	session: Doc<"bookings">,
	client: GoogleCalendarClient,
	reservation: SessionReservation
): ResultAsync<PreparedClaimedCalendarEvent, CompleteClaimedSessionError> {
	const payload = buildClaimedBookingCalendarPayload(session, client.timeZone);

	if (payload.isErr()) return failInvalidClaimedSession(ctx, session, reservation);

	return okAsync({ kind: "ready", body: payload.value });
}

export function selectReadyClaimedCalendarPayloads(prepared: PreparedClaimedCalendarEvent) {
	return prepared.kind === "ready" ? [prepared.body] : [];
}

export function resolveClaimedCalendarCreation(
	prepared: PreparedClaimedCalendarEvent,
	creations: InsertClaimedBookingCalendarEventResult[]
): InsertClaimedBookingCalendarEventResult {
	if (prepared.kind === "done") return prepared;

	const [creation] = creations;

	if (creation === undefined)
		throw new Error("Valid claimed booking did not produce a calendar result");

	return creation;
}

export function requireClaimed(
	session: Doc<"bookings">
): Result<Doc<"bookings">, { reason: "BOOKING_CONFIRMATION_NOT_CLAIMED" }> {
	return session.bookingConfirmationClaimedAt
		? ok(session)
		: err({ reason: "BOOKING_CONFIRMATION_NOT_CLAIMED" as const });
}

export function markClaimedBookingTimeUnavailable(ctx: ActionCtx, bookingId: Id<"bookings">) {
	return failBookingConfirmation(ctx, bookingId, "BOOKING_TIME_UNAVAILABLE").map(() => ({
		outcome: "booking_time_unavailable" as const
	}));
}

export function scheduleUnavailableDone(ctx: ActionCtx, bookingId: Id<"bookings">) {
	return markClaimedBookingTimeUnavailable(ctx, bookingId).map((outcome) => ({
		kind: "done" as const,
		outcome
	}));
}

export function finishVerifyClaimedBookingSchedule(
	ctx: ActionCtx,
	bookingId: Id<"bookings">,
	canBeScheduled: boolean
) {
	if (!canBeScheduled) {
		return scheduleUnavailableDone(ctx, bookingId);
	}

	return okAsync({ kind: "schedulable" as const });
}

export function reserveUnavailableDone(ctx: ActionCtx, bookingId: Id<"bookings">) {
	return markClaimedBookingTimeUnavailable(ctx, bookingId).map((outcome) => ({
		kind: "done" as const,
		outcome
	}));
}

export function finishReserveClaimedBookingSlot(
	ctx: ActionCtx,
	bookingId: Id<"bookings">,
	reservationResult: ReserveClaimedBookingSessionResult
) {
	if (reservationResult.outcome === "unavailable") {
		return reserveUnavailableDone(ctx, bookingId);
	}

	return okAsync({ kind: "reserved" as const, reservation: reservationResult.reservation });
}

export function buildClaimedBookingCalendarPayload(session: Doc<"bookings">, timeZone: string) {
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

export function failCalendarCreateForClaimedBooking(
	ctx: ActionCtx,
	session: Doc<"bookings">,
	reservation: SessionReservation,

	_error: { reason: string }
) {
	return failBookingConfirmation(
		ctx,
		session._id,
		"GOOGLE_CALENDAR_CREATE_FAILED",
		reservation
	).map(() => ({
		kind: "done" as const,
		outcome: { outcome: "google_calendar_create_failed" as const }
	}));
}

export function alreadyCompletedSession(
	session: Doc<"bookings">
): CompleteClaimedSessionSuccess | null {
	return session.status === "confirmed" || session.status === "email_failed"
		? { outcome: "already_completed" }
		: null;
}

export function loadedClaimedSessionFromPending(
	session: Doc<"bookings">
): ResultAsync<LoadedClaimedSession, never> {
	const completed = alreadyCompletedSession(session);

	return completed
		? okAsync({ kind: "done", outcome: completed })
		: okAsync({ kind: "pending", session });
}

export function insertClaimedCalendarEvent(
	client: GoogleCalendarClient,
	requestBody: calendar_v3.Schema$Event
) {
	return tryPromise({
		try: () =>
			client.calendar.events.insert({
				calendarId: client.calendarId,
				sendUpdates: "all",
				requestBody
			}),
		catch: (error) => {
			const parsed = calendarErrorSchema.safeParse(error);

			return {
				reason: parsed.success
					? mapCalendarErrorCode(parsed.data, "GOOGLE_CALENDAR_CREATE_FAILED")
					: "GOOGLE_CALENDAR_CREATE_FAILED"
			};
		}
	});
}

export function failInvalidClaimedSession(
	ctx: ActionCtx,
	session: Doc<"bookings">,
	reservation: SessionReservation
) {
	return failBookingConfirmation(ctx, session._id, "BOOKING_INVALID_INPUT", reservation).map(
		() => ({ kind: "done" as const, outcome: { outcome: "booking_invalid_input" as const } })
	);
}
