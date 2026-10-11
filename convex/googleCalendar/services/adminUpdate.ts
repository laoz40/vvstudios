"use node";

import { err, ResultAsync } from "neverthrow";
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
	return requirePermissionActions(ctx, "edit:sessions").andThen(() =>
		getSessionFromQuery(ctx, bookingId)
	);
}

export function loadAdminSessionEditDeps(ctx: ActionCtx) {
	return queryBookingAvailabilitySettings(ctx).andThen(loadAdminEditGoogleClient);
}

function verifyFailedSessionNewSlot(context: AdminUpdateContext) {
	return verifySessionCanBeScheduled(failedSessionAvailabilityArgs(context)).andThen(
		requireSchedulableFailedSession
	);
}

function buildFailedSessionGoogleEventPayload(context: AdminUpdateContext) {
	return requestFailedSessionEventPayload(context).andThen(mapFailedSessionPayloadResult);
}

function compensatePromotedSaveFailure(
	context: PromotedAdminUpdateContext,
	error: AdminSessionUpdateError
) {
	return cleanupPromotedEventAfterSaveFailure(context, error).andThen(() => err(error));
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
	return insertFailedSessionGoogleEvent({ client: context.client, requestBody }).andThen((event) =>
		savePromotedFailedSession({ ...context, googleEventId: event.data.id ?? undefined })
	);
}

function promoteFailedSession(context: AdminUpdateContext) {
	return verifyFailedSessionNewSlot(context)
		.andThen(() => buildFailedSessionGoogleEventPayload(context))
		.andThen((requestBody) => insertAndSaveFailedSession(context, requestBody))
		.map(() => ({ googleOutcome: "createdFromFailed" as const }));
}

function updateConfirmedGoogleEvent(context: AdminUpdateContext) {
	return updateSessionTimingWithGoogleCalendar({
		bypassAvailabilitySettings: true,
		session: context.session,
		client: context.client,
		date: context.args.date,
		details: eventDetails(context.args),
		duration: context.args.duration,
		settings: context.settings,
		time: context.args.time
	}).andThen((timingUpdate) => saveConfirmedTimingUpdate(context, timingUpdate));
}

function validateAndSaveDraft(context: AdminUpdateContext) {
	return validateSessionTimingEdit({
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
	}).andThen(() => saveAdminFieldsOnly(context));
}

function updateAndSaveConfirmed(context: AdminUpdateContext) {
	return updateConfirmedGoogleEvent(context).andThen((outcome) =>
		resolveConfirmedGoogleSyncOutcome(context, outcome)
	);
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
	return reserveSessionSlot(context.ctx, {
		bookingId: context.session._id,
		duration: context.args.duration,
		eventBufferMinutes: context.settings.eventBufferMinutes,
		sessionStartAt
	}).andThen(requireAvailableAdminReservation);
}

function reserveSlotForAdminTimingChange(context: AdminUpdateContext) {
	return getSessionStartAt(
		context.args.date,
		context.args.time,
		context.client.timeZone
	).asyncAndThen((sessionStartAt) => reserveAdminSlot(context, sessionStartAt));
}

function compensateFailedAdminUpdate(
	context: AdminUpdateContext,
	reservation: SessionReservation,
	error: AdminSessionUpdateError
) {
	return clearSessionSlotReservation(context.ctx, {
		bookingId: context.session._id,
		reservation
	}).andThen(() => err(error));
}

function syncWithAdminReservation(context: AdminUpdateContext, reservation: SessionReservation) {
	return syncAdminSessionGoogleAndSave({ ...context, reservation }).orElse(
		(error: AdminSessionUpdateError) => compensateFailedAdminUpdate(context, reservation, error)
	);
}

function reserveAndSyncAdminSession(context: AdminUpdateContext) {
	return reserveSlotForAdminTimingChange(context).andThen((reservation) =>
		syncWithAdminReservation(context, reservation)
	);
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
