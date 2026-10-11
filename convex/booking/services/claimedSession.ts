"use node";

import { ResultAsync } from "neverthrow";
import type { Doc, Id } from "#convex/_generated/dataModel";
import type { ActionCtx } from "#convex/_generated/server";
import { queryBookingAvailabilitySettings } from "#convex/booking/lib/settingsIo";
import { reserveClaimedBookingSession } from "#convex/booking/lib/confirmationActionBoundaries";
import {
	saveConfirmedBooking,
	sendConfirmedBookingInvoice
} from "#convex/booking/services/confirmationWorkflow";
import { getGoogleCalendarClient } from "#convex/googleCalendar/lib/googleCalendarClient";
import type { SessionAvailabilitySettings } from "#convex/sessions/lib/calendarTime";
import { verifySessionCanBeScheduled } from "#convex/sessions/services/adminEdit";
import type { SessionReservation } from "#convex/sessions/lib/reservations";
import { getSessionFromQuery } from "#convex/sessions/services/lookup";
import type { CompleteClaimedSessionSuccess } from "#convex/booking/services/confirmation";
import {
	requireClaimed,
	loadedClaimedSessionFromPending,
	finishVerifyClaimedBookingSchedule,
	finishReserveClaimedBookingSlot,
	prepareClaimedCalendarEvent,
	selectReadyClaimedCalendarPayloads,
	resolveClaimedCalendarCreation,
	selectConfirmedClaimedBookings,
	selectCreatedClaimedCalendarEvents,
	selectClaimedBookingReservations,
	selectSchedulableClaimedSessions,
	selectPendingClaimedSessions,
	resolveClaimedSessionCompletion,
	failCalendarCreateForClaimedBooking,
	insertClaimedCalendarEvent,
	type CompleteClaimedSessionError as ClaimedError,
	type LoadedClaimedSession as LoadedSession,
	type GoogleCalendarClient,
	type VerifyClaimedBookingScheduleResult,
	type ReserveClaimedBookingSlotResult,
	type InsertClaimedBookingCalendarEventResult
} from "#convex/booking/lib/claimedSessionSteps";

export type CompleteClaimedSessionError = ClaimedError;

export type LoadedClaimedSession = LoadedSession;

export function loadClaimedSession(
	ctx: ActionCtx,
	bookingId: Id<"bookings">
): ResultAsync<LoadedClaimedSession, CompleteClaimedSessionError> {
	return getSessionFromQuery(ctx, bookingId)
		.andThen(requireClaimed)
		.andThen(loadedClaimedSessionFromPending);
}

export function verifyClaimedBookingSchedule(
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
	}).andThen((available) => finishVerifyClaimedBookingSchedule(ctx, session._id, available));
}

export function reserveClaimedBookingSlot(
	ctx: ActionCtx,
	session: Doc<"bookings">,
	settings: SessionAvailabilitySettings
): ResultAsync<ReserveClaimedBookingSlotResult, CompleteClaimedSessionError> {
	return reserveClaimedBookingSession(ctx, {
		bookingId: session._id,
		duration: session.duration,
		eventBufferMinutes: settings.eventBufferMinutes,
		sessionStartAt: session.sessionStartAt
	}).andThen((reservation) => finishReserveClaimedBookingSlot(ctx, session._id, reservation));
}

function insertAndHandleClaimedCalendarEvent(
	ctx: ActionCtx,
	session: Doc<"bookings">,
	client: GoogleCalendarClient,
	reservation: SessionReservation,
	body: Parameters<typeof insertClaimedCalendarEvent>[1]
): ResultAsync<InsertClaimedBookingCalendarEventResult, CompleteClaimedSessionError> {
	return insertClaimedCalendarEvent(client, body)
		.map((createdEvent) => ({
			kind: "created" as const,
			googleEventId: createdEvent.data.id ?? undefined
		}))
		.orElse((error) => failCalendarCreateForClaimedBooking(ctx, session, reservation, error));
}

export function createClaimedBookingCalendarEvent(
	ctx: ActionCtx,
	session: Doc<"bookings">,
	client: GoogleCalendarClient,
	reservation: SessionReservation
): ResultAsync<InsertClaimedBookingCalendarEventResult, CompleteClaimedSessionError> {
	return prepareClaimedCalendarEvent(ctx, session, client, reservation).andThen((prepared) =>
		ResultAsync.combine(
			selectReadyClaimedCalendarPayloads(prepared).map((body) =>
				insertAndHandleClaimedCalendarEvent(ctx, session, client, reservation, body)
			)
		).map((creations) => resolveClaimedCalendarCreation(prepared, creations))
	);
}

export function saveConfirmedClaimedBookingAndSendInvoice(
	ctx: ActionCtx,
	session: Doc<"bookings">,
	settings: SessionAvailabilitySettings,
	client: GoogleCalendarClient,
	reservation: SessionReservation,
	eventId: string | undefined
): ResultAsync<CompleteClaimedSessionSuccess, CompleteClaimedSessionError> {
	return saveConfirmedBooking(ctx, session, client, reservation, eventId).andThen((saved) =>
		ResultAsync.combine(
			selectConfirmedClaimedBookings(saved, session).map((confirmed) =>
				sendConfirmedBookingInvoice(ctx, confirmed, settings)
			)
		).map(() => ({ outcome: saved ? ("completed" as const) : ("reservation_lost" as const) }))
	);
}

function finishClaimedSessionAfterCalendarEvent(
	ctx: ActionCtx,
	session: Doc<"bookings">,
	settings: SessionAvailabilitySettings,
	client: GoogleCalendarClient,
	reservation: SessionReservation,
	calendar: InsertClaimedBookingCalendarEventResult
) {
	return ResultAsync.combine(
		selectCreatedClaimedCalendarEvents(calendar).map((created) =>
			saveConfirmedClaimedBookingAndSendInvoice(
				ctx,
				session,
				settings,
				client,
				reservation,
				created.googleEventId
			)
		)
	).map((completions) => resolveClaimedSessionCompletion(calendar, completions));
}

function createAndContinueClaimedSession(
	ctx: ActionCtx,
	session: Doc<"bookings">,
	settings: SessionAvailabilitySettings,
	client: GoogleCalendarClient,
	reservation: SessionReservation
) {
	return createClaimedBookingCalendarEvent(ctx, session, client, reservation).andThen((calendar) =>
		finishClaimedSessionAfterCalendarEvent(ctx, session, settings, client, reservation, calendar)
	);
}

function continueClaimedSessionAfterReservation(
	ctx: ActionCtx,
	session: Doc<"bookings">,
	settings: SessionAvailabilitySettings,
	client: GoogleCalendarClient,
	hold: ReserveClaimedBookingSlotResult
) {
	return ResultAsync.combine(
		selectClaimedBookingReservations(hold).map((reservation) =>
			createAndContinueClaimedSession(ctx, session, settings, client, reservation)
		)
	).map((completions) => resolveClaimedSessionCompletion(hold, completions));
}

function reserveAndContinueClaimedSession(
	ctx: ActionCtx,
	session: Doc<"bookings">,
	settings: SessionAvailabilitySettings,
	client: GoogleCalendarClient
) {
	return reserveClaimedBookingSlot(ctx, session, settings).andThen((hold) =>
		continueClaimedSessionAfterReservation(ctx, session, settings, client, hold)
	);
}

function continueClaimedSessionAfterScheduleCheck(
	ctx: ActionCtx,
	session: Doc<"bookings">,
	settings: SessionAvailabilitySettings,
	client: GoogleCalendarClient,
	schedule: VerifyClaimedBookingScheduleResult
) {
	return ResultAsync.combine(
		selectSchedulableClaimedSessions(schedule, session).map((schedulable) =>
			reserveAndContinueClaimedSession(ctx, schedulable, settings, client)
		)
	).map((completions) => resolveClaimedSessionCompletion(schedule, completions));
}

function runClaimedSessionWithSettings(
	ctx: ActionCtx,
	session: Doc<"bookings">,
	client: GoogleCalendarClient,
	settings: SessionAvailabilitySettings
) {
	return verifyClaimedBookingSchedule(ctx, session, settings, client).andThen((schedule) =>
		continueClaimedSessionAfterScheduleCheck(ctx, session, settings, client, schedule)
	);
}

function runCompleteClaimedSessionWhenPending(ctx: ActionCtx, session: Doc<"bookings">) {
	const calendarClient = getGoogleCalendarClient();

	return queryBookingAvailabilitySettings(ctx).andThen((settings: SessionAvailabilitySettings) =>
		runClaimedSessionWithSettings(ctx, session, calendarClient, settings)
	);
}

function completeClaimedSessionFromLoaded(ctx: ActionCtx, loaded: LoadedClaimedSession) {
	return ResultAsync.combine(
		selectPendingClaimedSessions(loaded).map((session) =>
			runCompleteClaimedSessionWhenPending(ctx, session)
		)
	).map((completions) => resolveClaimedSessionCompletion(loaded, completions));
}

export function runCompleteClaimedSession(
	ctx: ActionCtx,
	bookingId: Id<"bookings">
): ResultAsync<CompleteClaimedSessionSuccess, CompleteClaimedSessionError> {
	return loadClaimedSession(ctx, bookingId).andThen((loaded) =>
		completeClaimedSessionFromLoaded(ctx, loaded)
	);
}
