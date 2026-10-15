"use node";

import { ok, ResultAsync, safeTry } from "neverthrow";
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
	return safeTry(async function* () {
		const session = yield* getSessionFromQuery(ctx, bookingId);
		const claimed = yield* requireClaimed(session);
		const loaded = yield* loadedClaimedSessionFromPending(claimed);

		return ok(loaded);
	});
}

export function verifyClaimedBookingSchedule(
	ctx: ActionCtx,
	session: Doc<"bookings">,
	settings: SessionAvailabilitySettings,
	calendarClient: GoogleCalendarClient
): ResultAsync<VerifyClaimedBookingScheduleResult, CompleteClaimedSessionError> {
	return safeTry(async function* () {
		const availability = yield* verifySessionCanBeScheduled({
			session,
			calendar: calendarClient.calendar,
			calendarIds: calendarClient.calendarIds,
			settings,
			timeZone: calendarClient.timeZone
		});

		const result = yield* finishVerifyClaimedBookingSchedule(ctx, session._id, availability);

		return ok(result);
	});
}

export function reserveClaimedBookingSlot(
	ctx: ActionCtx,
	session: Doc<"bookings">,
	settings: SessionAvailabilitySettings
): ResultAsync<ReserveClaimedBookingSlotResult, CompleteClaimedSessionError> {
	return safeTry(async function* () {
		const reservation = yield* reserveClaimedBookingSession(ctx, {
			bookingId: session._id,
			duration: session.duration,
			eventBufferMinutes: settings.eventBufferMinutes,
			sessionStartAt: session.sessionStartAt
		});

		const result = yield* finishReserveClaimedBookingSlot(ctx, session._id, reservation);

		return ok(result);
	});
}

function insertAndHandleClaimedCalendarEvent(
	ctx: ActionCtx,
	session: Doc<"bookings">,
	client: GoogleCalendarClient,
	reservation: SessionReservation,
	body: Parameters<typeof insertClaimedCalendarEvent>[1]
): ResultAsync<InsertClaimedBookingCalendarEventResult, CompleteClaimedSessionError> {
	return safeTry(async function* () {
		const createdEvent = yield* insertClaimedCalendarEvent(client, body, session._id);

		return ok({ kind: "created" as const, googleEventId: createdEvent.data.id ?? undefined });
	}).orElse((error) => failCalendarCreateForClaimedBooking(ctx, session, reservation, error));
}

export function createClaimedBookingCalendarEvent(
	ctx: ActionCtx,
	session: Doc<"bookings">,
	client: GoogleCalendarClient,
	reservation: SessionReservation
): ResultAsync<InsertClaimedBookingCalendarEventResult, CompleteClaimedSessionError> {
	return safeTry(async function* () {
		const prepared = yield* prepareClaimedCalendarEvent(ctx, session, client, reservation);

		const creations = yield* ResultAsync.combine(
			selectReadyClaimedCalendarPayloads(prepared).map((body) =>
				insertAndHandleClaimedCalendarEvent(ctx, session, client, reservation, body)
			)
		);

		return ok(resolveClaimedCalendarCreation(prepared, creations));
	});
}

export function saveConfirmedClaimedBookingAndSendInvoice(
	ctx: ActionCtx,
	session: Doc<"bookings">,
	settings: SessionAvailabilitySettings,
	client: GoogleCalendarClient,
	reservation: SessionReservation,
	eventId: string | undefined
): ResultAsync<CompleteClaimedSessionSuccess, CompleteClaimedSessionError> {
	return safeTry(async function* () {
		const saved = yield* saveConfirmedBooking(ctx, session, client, reservation, eventId);
		yield* ResultAsync.combine(
			selectConfirmedClaimedBookings(saved, session).map((confirmed) =>
				sendConfirmedBookingInvoice(ctx, confirmed, settings)
			)
		);

		return ok({ outcome: saved ? ("completed" as const) : ("reservation_lost" as const) });
	});
}

function finishClaimedSessionAfterCalendarEvent(
	ctx: ActionCtx,
	session: Doc<"bookings">,
	settings: SessionAvailabilitySettings,
	client: GoogleCalendarClient,
	reservation: SessionReservation,
	calendar: InsertClaimedBookingCalendarEventResult
) {
	return safeTry(async function* () {
		const completions = yield* ResultAsync.combine(
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
		);

		return ok(resolveClaimedSessionCompletion(calendar, completions));
	});
}

function createAndContinueClaimedSession(
	ctx: ActionCtx,
	session: Doc<"bookings">,
	settings: SessionAvailabilitySettings,
	client: GoogleCalendarClient,
	reservation: SessionReservation
) {
	return safeTry(async function* () {
		const calendar = yield* createClaimedBookingCalendarEvent(ctx, session, client, reservation);

		const result = yield* finishClaimedSessionAfterCalendarEvent(
			ctx,
			session,
			settings,
			client,
			reservation,
			calendar
		);

		return ok(result);
	});
}

function continueClaimedSessionAfterReservation(
	ctx: ActionCtx,
	session: Doc<"bookings">,
	settings: SessionAvailabilitySettings,
	client: GoogleCalendarClient,
	hold: ReserveClaimedBookingSlotResult
) {
	return safeTry(async function* () {
		const completions = yield* ResultAsync.combine(
			selectClaimedBookingReservations(hold).map((reservation) =>
				createAndContinueClaimedSession(ctx, session, settings, client, reservation)
			)
		);

		return ok(resolveClaimedSessionCompletion(hold, completions));
	});
}

function reserveAndContinueClaimedSession(
	ctx: ActionCtx,
	session: Doc<"bookings">,
	settings: SessionAvailabilitySettings,
	client: GoogleCalendarClient
) {
	return safeTry(async function* () {
		const hold = yield* reserveClaimedBookingSlot(ctx, session, settings);

		const result = yield* continueClaimedSessionAfterReservation(
			ctx,
			session,
			settings,
			client,
			hold
		);

		return ok(result);
	});
}

function continueClaimedSessionAfterScheduleCheck(
	ctx: ActionCtx,
	session: Doc<"bookings">,
	settings: SessionAvailabilitySettings,
	client: GoogleCalendarClient,
	schedule: VerifyClaimedBookingScheduleResult
) {
	return safeTry(async function* () {
		const completions = yield* ResultAsync.combine(
			selectSchedulableClaimedSessions(schedule, session).map((schedulable) =>
				reserveAndContinueClaimedSession(ctx, schedulable, settings, client)
			)
		);

		return ok(resolveClaimedSessionCompletion(schedule, completions));
	});
}

function runClaimedSessionWithSettings(
	ctx: ActionCtx,
	session: Doc<"bookings">,
	client: GoogleCalendarClient,
	settings: SessionAvailabilitySettings
) {
	return safeTry(async function* () {
		const schedule = yield* verifyClaimedBookingSchedule(ctx, session, settings, client);

		const result = yield* continueClaimedSessionAfterScheduleCheck(
			ctx,
			session,
			settings,
			client,
			schedule
		);

		return ok(result);
	});
}

function runCompleteClaimedSessionWhenPending(ctx: ActionCtx, session: Doc<"bookings">) {
	const calendarClient = getGoogleCalendarClient();

	return safeTry(async function* () {
		const settings: SessionAvailabilitySettings = yield* queryBookingAvailabilitySettings(ctx);
		const result = yield* runClaimedSessionWithSettings(ctx, session, calendarClient, settings);

		return ok(result);
	});
}

function completeClaimedSessionFromLoaded(ctx: ActionCtx, loaded: LoadedClaimedSession) {
	return safeTry(async function* () {
		const completions = yield* ResultAsync.combine(
			selectPendingClaimedSessions(loaded).map((session) =>
				runCompleteClaimedSessionWhenPending(ctx, session)
			)
		);

		return ok(resolveClaimedSessionCompletion(loaded, completions));
	});
}

export function runCompleteClaimedSession(
	ctx: ActionCtx,
	bookingId: Id<"bookings">
): ResultAsync<CompleteClaimedSessionSuccess, CompleteClaimedSessionError> {
	return safeTry(async function* () {
		const loaded = yield* loadClaimedSession(ctx, bookingId);
		const result = yield* completeClaimedSessionFromLoaded(ctx, loaded);

		return ok(result);
	});
}
