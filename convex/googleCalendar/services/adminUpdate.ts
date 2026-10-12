"use node";

import { err, ok, ResultAsync, safeTry } from "neverthrow";
import type { Doc, Id } from "#convex/_generated/dataModel";
import type { ActionCtx } from "#convex/_generated/server";
import { queryBookingAvailabilitySettings } from "#convex/booking/lib/settingsIo";
import { getSessionFromQuery } from "#convex/sessions/services/lookup";
import { requirePermissionActions } from "#convex/shared/services/requirePermissionActions";
import {
	clearSessionSlotReservation,
	reserveSessionSlot,
	saveAdminSessionUpdate
} from "#convex/sessions/lib/calendarActionBoundaries";
import { updateSessionTimingWithGoogleCalendar } from "#convex/googleCalendar/services/calendarTimingSync";
import type { SessionAvailabilitySettings } from "#convex/sessions/lib/calendarTime";
import type { SessionReservation } from "#convex/sessions/lib/reservations";
import {
	getSessionStartAt,
	type AdminSessionUpdateArgs,
	type AdminSessionUpdateError,
	type AdminSessionUpdateResult as LibAdminSessionUpdateResult
} from "#convex/sessions/lib/adminEdit";
import {
	validateSessionTimingEdit,
	verifySessionCanBeScheduled
} from "#convex/sessions/services/adminEdit";
import { notifyHostOfAdminSessionReschedule } from "#convex/sessions/services/rescheduleEmails";
import {
	eventDetails,
	requireSchedulableFailedSession,
	mapFailedSessionPayloadResult,
	insertFailedSessionGoogleEvent,
	loadAdminEditGoogleClient,
	saveAdminFieldsOnly,
	saveConfirmedTimingUpdate,
	resolveConfirmedGoogleSyncOutcome,
	requireAvailableAdminReservation,
	failedSessionAvailabilityArgs,
	requestFailedSessionEventPayload,
	promotedSessionSaveArgs,
	cleanupPromotedEventAfterSaveFailure,
	selectFailedAdminSessions,
	selectNonFailedAdminSessions,
	selectDraftAdminSessions,
	selectConfirmedAdminSessions,
	selectConfirmedSessionsNeedingGoogleSync,
	selectConfirmedSessionsNeedingFieldsOnly,
	selectAdminSessionsWithTimingChanges,
	selectAdminSessionsWithoutTimingChanges,
	selectAdminSessionsNeedingHostNotification,
	type AdminUpdateContext,
	type PromotedAdminUpdateContext
} from "#convex/googleCalendar/lib/adminUpdateSteps";

export type AdminSessionUpdateResult = LibAdminSessionUpdateResult;

export function requireEditSessionsPermissionAndLoadBooking(
	ctx: ActionCtx,
	bookingId: Id<"bookings">
) {
	return safeTry(async function* () {
		yield* requirePermissionActions(ctx, "edit:sessions");

		return ok(yield* getSessionFromQuery(ctx, bookingId));
	});
}

export function loadAdminSessionEditDeps(ctx: ActionCtx) {
	return safeTry(async function* () {
		const settings = yield* queryBookingAvailabilitySettings(ctx);

		return ok(yield* loadAdminEditGoogleClient(settings));
	});
}

function verifyFailedSessionNewSlot(context: AdminUpdateContext) {
	return safeTry(async function* () {
		const availability = yield* verifySessionCanBeScheduled(failedSessionAvailabilityArgs(context));

		return ok(yield* requireSchedulableFailedSession(availability));
	});
}

function buildFailedSessionGoogleEventPayload(context: AdminUpdateContext) {
	return safeTry(async function* () {
		const payloadResult = yield* requestFailedSessionEventPayload(context);

		return ok(yield* mapFailedSessionPayloadResult(payloadResult));
	});
}

function compensatePromotedSaveFailure(
	context: PromotedAdminUpdateContext,
	error: AdminSessionUpdateError
) {
	return safeTry(async function* () {
		yield* cleanupPromotedEventAfterSaveFailure(context, error);

		return err(error);
	});
}

function savePromotedFailedSession(context: PromotedAdminUpdateContext) {
	return saveAdminSessionUpdate(context.ctx, promotedSessionSaveArgs(context)).orElse((error) =>
		compensatePromotedSaveFailure(context, error)
	);
}

function insertAndSaveFailedSession(
	context: AdminUpdateContext,
	requestBody: Parameters<typeof insertFailedSessionGoogleEvent>[0]["requestBody"]
) {
	return safeTry(async function* () {
		const event = yield* insertFailedSessionGoogleEvent({ client: context.client, requestBody });

		return ok(
			yield* savePromotedFailedSession({ ...context, googleEventId: event.data.id ?? undefined })
		);
	});
}

function promoteFailedSession(context: AdminUpdateContext) {
	return safeTry(async function* () {
		yield* verifyFailedSessionNewSlot(context);
		const requestBody = yield* buildFailedSessionGoogleEventPayload(context);
		yield* insertAndSaveFailedSession(context, requestBody);

		return ok({ googleOutcome: "createdFromFailed" as const });
	});
}

function updateConfirmedGoogleEvent(context: AdminUpdateContext) {
	return safeTry(async function* () {
		const timingUpdate = yield* updateSessionTimingWithGoogleCalendar({
			bypassAvailabilitySettings: true,
			session: context.session,
			client: context.client,
			date: context.args.date,
			details: eventDetails(context.args),
			duration: context.args.duration,
			settings: context.settings,
			time: context.args.time
		});

		return ok(yield* saveConfirmedTimingUpdate(context, timingUpdate));
	});
}

function validateAndSaveDraft(context: AdminUpdateContext) {
	return safeTry(async function* () {
		yield* validateSessionTimingEdit({
			bypassAvailabilitySettings: true,
			calendar: context.client.calendar,
			calendarIds: context.client.calendarIds,
			existing: {
				date: context.session.date,
				duration: context.session.duration,
				googleCalendarId: context.session.googleCalendarId,
				googleEventId: context.session.googleEventId,
				time: context.session.time
			},
			next: { date: context.args.date, duration: context.args.duration, time: context.args.time },
			settings: context.settings,
			timeZone: context.client.timeZone
		});

		return ok(yield* saveAdminFieldsOnly(context));
	});
}

function updateAndSaveConfirmed(context: AdminUpdateContext) {
	return safeTry(async function* () {
		const outcome = yield* updateConfirmedGoogleEvent(context);

		return ok(yield* resolveConfirmedGoogleSyncOutcome(context, outcome));
	});
}

function syncAdminSessionGoogleAndSave(context: AdminUpdateContext) {
	return ResultAsync.combine([
		...selectFailedAdminSessions(context).map(promoteFailedSession),
		...selectNonFailedAdminSessions(context).map(syncNonFailedAdminSession)
	]).map((results) => results[0] ?? {});
}

function syncNonFailedAdminSession(context: AdminUpdateContext) {
	return ResultAsync.combine([
		...selectDraftAdminSessions(context).map(validateAndSaveDraft),
		...selectConfirmedAdminSessions(context).map(syncConfirmedAdminSession)
	]).map((results) => results[0] ?? {});
}

function syncConfirmedAdminSession(context: AdminUpdateContext) {
	return ResultAsync.combine([
		...selectConfirmedSessionsNeedingGoogleSync(context).map(updateAndSaveConfirmed),
		...selectConfirmedSessionsNeedingFieldsOnly(context).map(saveAdminFieldsOnly)
	]).map((results) => results[0] ?? {});
}

function reserveAdminSlot(context: AdminUpdateContext, sessionStartAt: number) {
	return safeTry(async function* () {
		const reservation = yield* reserveSessionSlot(context.ctx, {
			bookingId: context.session._id,
			duration: context.args.duration,
			eventBufferMinutes: context.settings.eventBufferMinutes,
			sessionStartAt
		});

		return ok(yield* requireAvailableAdminReservation(reservation));
	});
}

function reserveSlotForAdminTimingChange(context: AdminUpdateContext) {
	return safeTry(async function* () {
		const sessionStartAt = yield* getSessionStartAt(
			context.args.date,
			context.args.time,
			context.client.timeZone
		);

		return ok(yield* reserveAdminSlot(context, sessionStartAt));
	});
}

function compensateFailedAdminUpdate(
	context: AdminUpdateContext,
	reservation: SessionReservation,
	error: AdminSessionUpdateError
) {
	return safeTry(async function* () {
		yield* clearSessionSlotReservation(context.ctx, {
			bookingId: context.session._id,
			reservation
		});

		return err(error);
	});
}

function syncWithAdminReservation(context: AdminUpdateContext, reservation: SessionReservation) {
	return syncAdminSessionGoogleAndSave({ ...context, reservation }).orElse(
		(error: AdminSessionUpdateError) => compensateFailedAdminUpdate(context, reservation, error)
	);
}

function reserveAndSyncAdminSession(context: AdminUpdateContext) {
	return safeTry(async function* () {
		const reservation = yield* reserveSlotForAdminTimingChange(context);

		return ok(yield* syncWithAdminReservation(context, reservation));
	});
}

export function attachAdminUpdateContext(
	session: Doc<"bookings">,
	settings: SessionAvailabilitySettings,
	result: AdminSessionUpdateResult
) {
	return { result, session, settings };
}

export function syncAdminBookingGoogleCalendarAndDb(context: AdminUpdateContext) {
	return ResultAsync.combine([
		...selectAdminSessionsWithTimingChanges(context).map(reserveAndSyncAdminSession),
		...selectAdminSessionsWithoutTimingChanges(context).map(syncAdminSessionGoogleAndSave)
	]).map((results) => results[0] ?? {});
}

export function notifyHostIfNeeded(
	ctx: ActionCtx,
	args: AdminSessionUpdateArgs,
	session: Doc<"bookings">,
	settings: SessionAvailabilitySettings,
	result: AdminSessionUpdateResult
) {
	return ResultAsync.combine(
		selectAdminSessionsNeedingHostNotification(args, session, settings, result).map(
			({
				args: eligibleArgs,
				session: eligibleSession,
				settings: eligibleSettings,
				result: eligibleResult
			}) =>
				notifyHostOfAdminSessionReschedule(ctx, {
					bookingId: eligibleArgs.bookingId,
					leadTimeMinutes: eligibleSettings.leadTimeMinutes,
					originalDate: eligibleSession.date,
					originalTime: eligibleSession.time,
					result: eligibleResult
				})
		)
	).map((results) => results[0] ?? result);
}
