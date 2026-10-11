"use node";

import { err, errAsync, ok, okAsync, type ResultAsync } from "neverthrow";
import type { Doc } from "#convex/_generated/dataModel";
import type { ActionCtx } from "#convex/_generated/server";
import { queryBookingAvailabilitySettings } from "#convex/booking/lib/settingsIo";
import type { getGoogleCalendarClient } from "#convex/googleCalendar/lib/googleCalendarClient";
import { loadGoogleCalendarClient } from "#convex/googleCalendar/lib/googleCalendarClient";
import { getBookingSubmitRateLimitKey } from "#convex/booking/lib/submission";
import { checkBookingSubmitRateLimit } from "#convex/shared/services/rateLimits";
import {
	clearSessionSlotReservation,
	loadValidRescheduleLinkAndSession,
	lockRescheduleLink,
	reserveSessionSlot,
	saveClientSessionReschedule,
	unlockRescheduleLink,
	type ValidRescheduleDetails as LibValidRescheduleDetails
} from "#convex/sessions/lib/calendarActionBoundaries";
import {
	buildRescheduleCalendarTimingArgs,
	buildSaveClientSessionRescheduleArgs,
	logRescheduleReservationCleanupFailureResult,
	logRescheduleUnlockFailureResult,
	resolveRescheduleReservation,
	updatedRescheduledBooking
} from "#convex/googleCalendar/lib/calendarReschedule";
import { updateSessionTimingWithGoogleCalendar } from "#convex/googleCalendar/services/calendarTimingSync";
import { getSessionStartAt } from "#convex/sessions/lib/adminEdit";
import { validateSessionTimingEdit } from "#convex/sessions/services/adminEdit";
import type { SessionAvailabilitySettings } from "#convex/sessions/lib/calendarTime";
import { sendBookingRescheduledEmailsForBooking } from "#convex/sessions/services/rescheduleEmails";
import { getRescheduleUrlForToken } from "#convex/sessions/lib/rescheduleLinks";
import type { AdminSessionUpdateError } from "#convex/sessions/lib/adminEdit";
import type { RescheduleLinkLookupError } from "#convex/sessions/lib/rescheduleLinks";

export type RescheduleSessionError =
	| RescheduleLinkLookupError
	| AdminSessionUpdateError
	| { reason: "BOOKING_RATE_LIMITED"; retryAfter?: number };

export type ValidRescheduleDetails = LibValidRescheduleDetails;

export type RescheduleSessionArgs = { date: string; time: string; token: string };

type RescheduleReservation = { reservedAt: number; sessionStartAt: number; duration: string };

export type RescheduleState = {
	link: Doc<"bookingRescheduleLinks">;
	lockedAt: number;
	reservation: RescheduleReservation;
	session: Doc<"bookings">;
	settings: SessionAvailabilitySettings;
};

type RescheduledSessionTimingUpdate = {
	googleCalendarId?: string;
	googleEventId?: string;
	sessionStartAt: number;
};

export type ValidatedRescheduleTarget = {
	calendarClient: ReturnType<typeof getGoogleCalendarClient>;
	details: ValidRescheduleDetails;
	sessionStartAt: number;
	settings: SessionAvailabilitySettings;
};

function enforceRescheduleSubmitRateLimit(
	ctx: ActionCtx,
	details: ValidRescheduleDetails,
	submitRateLimitKey: string
) {
	return checkBookingSubmitRateLimit(ctx, submitRateLimitKey).map(() => details);
}

function loadLinkWithRateLimit(ctx: ActionCtx, details: ValidRescheduleDetails) {
	return getBookingSubmitRateLimitKey(details.session.email).andThen((submitRateLimitKey: string) =>
		enforceRescheduleSubmitRateLimit(ctx, details, submitRateLimitKey)
	);
}

function loadLink(
	ctx: ActionCtx,
	args: RescheduleSessionArgs
): ResultAsync<ValidRescheduleDetails, RescheduleSessionError> {
	return loadValidRescheduleLinkAndSession(ctx, { token: args.token, now: Date.now() }).andThen(
		(details: ValidRescheduleDetails) => loadLinkWithRateLimit(ctx, details)
	);
}

function validateRescheduleTargetForCalendarClient(
	args: RescheduleSessionArgs,
	details: ValidRescheduleDetails,
	settings: SessionAvailabilitySettings,

	calendarClient: ReturnType<typeof getGoogleCalendarClient>
) {
	return validateRescheduleTiming(args, details.session, settings, calendarClient).andThen(() =>
		getSessionStartAt(args.date, args.time, calendarClient.timeZone)
			.map((sessionStartAt) => ({ calendarClient, details, sessionStartAt, settings }))
			.asyncAndThen((context) => okAsync(context))
	);
}

function validateRescheduleTargetWithSettings(
	args: RescheduleSessionArgs,
	details: ValidRescheduleDetails,

	settings: SessionAvailabilitySettings
) {
	return loadGoogleCalendarClient("GOOGLE_CALENDAR_AVAILABILITY_FAILED").andThen(
		(calendarClient: ReturnType<typeof getGoogleCalendarClient>) =>
			validateRescheduleTargetForCalendarClient(args, details, settings, calendarClient)
	);
}

function validateTarget(
	ctx: ActionCtx,
	args: RescheduleSessionArgs,
	details: ValidRescheduleDetails
) {
	return queryBookingAvailabilitySettings(ctx).andThen((settings: SessionAvailabilitySettings) =>
		validateRescheduleTargetWithSettings(args, details, settings)
	);
}

export function loadRescheduleTargetAndValidate(ctx: ActionCtx, args: RescheduleSessionArgs) {
	return loadLink(ctx, args).andThen((details: ValidRescheduleDetails) =>
		validateTarget(ctx, args, details)
	);
}

export function validateRescheduleTiming(
	args: RescheduleSessionArgs,
	session: Doc<"bookings">,
	settings: SessionAvailabilitySettings,
	calendarClient: ReturnType<typeof getGoogleCalendarClient>
): ResultAsync<null, AdminSessionUpdateError> {
	return validateSessionTimingEdit({
		calendar: calendarClient.calendar,
		calendarIds: calendarClient.calendarIds,
		existing: {
			date: session.date,
			duration: session.duration,
			googleCalendarId: session.googleCalendarId,
			googleEventId: session.googleEventId,
			time: session.time
		},
		next: { date: args.date, duration: session.duration, time: args.time },
		settings,
		timeZone: calendarClient.timeZone
	});
}

function reserveSessionSlotAfterLock(
	ctx: ActionCtx,
	details: ValidRescheduleDetails,
	lockedAt: number,
	settings: SessionAvailabilitySettings,
	sessionStartAt: number,

	_linkLocked: null
) {
	return reserveSessionSlot(ctx, {
		bookingId: details.session._id,
		duration: details.session.duration,
		eventBufferMinutes: settings.eventBufferMinutes,
		sessionStartAt
	}).andThen(
		(
			reservationResult:
				| { outcome: "reserved"; reservation: RescheduleReservation }
				| { outcome: "unavailable" }
		) => resolveRescheduleReservation(details, lockedAt, settings, reservationResult)
	);
}

export function lockAndReserve(
	ctx: ActionCtx,
	details: ValidRescheduleDetails,
	sessionStartAt: number,
	settings: SessionAvailabilitySettings
): ResultAsync<RescheduleState, RescheduleSessionError> {
	const lockedAt = Date.now();

	const unlockAndReturnReservationError = <Error extends { reason: string }>(
		reservationError: Error
	) => releaseRescheduleLink(ctx, details.link._id, lockedAt).andThen(() => err(reservationError));

	return lockRescheduleLink(ctx, { linkId: details.link._id, now: lockedAt })
		.andThen((_linkLocked: null) =>
			reserveSessionSlotAfterLock(ctx, details, lockedAt, settings, sessionStartAt, _linkLocked)
		)
		.orElse(unlockAndReturnReservationError);
}

function releaseRescheduleLink(
	ctx: ActionCtx,
	linkId: Doc<"bookingRescheduleLinks">["_id"],
	lockedAt: number
) {
	return unlockRescheduleLink(ctx, { linkId, lockedAt }).orElse((error: { reason: string }) =>
		logRescheduleUnlockFailureResult(linkId, error)
	);
}

function clearReservationThenUnlock(ctx: ActionCtx, state: RescheduleState) {
	return clearSessionSlotReservation(ctx, {
		bookingId: state.session._id,
		reservation: state.reservation
	})
		.orElse((error: AdminSessionUpdateError) =>
			logRescheduleReservationCleanupFailureResult(state.session._id, error)
		)
		.andThen((_reservationCleared: { cleared: boolean } | null | void) =>
			releaseRescheduleLink(ctx, state.link._id, state.lockedAt)
		);
}

function rollbackRescheduleOnCalendarError(
	ctx: ActionCtx,
	state: RescheduleState,
	error: RescheduleSessionError
) {
	return clearReservationThenUnlock(ctx, state).andThen(() => errAsync(error));
}

export function syncCalendar(
	ctx: ActionCtx,
	args: RescheduleSessionArgs,
	state: RescheduleState,
	calendarClient: ReturnType<typeof getGoogleCalendarClient>
): ResultAsync<
	RescheduleState & { timingUpdate: RescheduledSessionTimingUpdate },
	RescheduleSessionError
> {
	return updateSessionTimingWithGoogleCalendar(
		buildRescheduleCalendarTimingArgs(state, calendarClient, args, state.settings)
	)
		.map((timingUpdate: RescheduledSessionTimingUpdate) => ({ ...state, timingUpdate }))
		.orElse((error: RescheduleSessionError) =>
			rollbackRescheduleOnCalendarError(ctx, state, error)
		);
}

function rollbackRescheduleOnSaveError(
	ctx: ActionCtx,
	state: RescheduleState & { timingUpdate: RescheduledSessionTimingUpdate },

	error: RescheduleSessionError
) {
	return clearReservationThenUnlock(ctx, state).andThen(() => errAsync(error));
}

function saveReschedule(
	ctx: ActionCtx,
	args: RescheduleSessionArgs,
	state: RescheduleState & { timingUpdate: RescheduledSessionTimingUpdate }
) {
	return saveClientSessionReschedule(ctx, buildSaveClientSessionRescheduleArgs(state, args))
		.map(() => state)
		.orElse((error: RescheduleSessionError) => rollbackRescheduleOnSaveError(ctx, state, error));
}

function unlockSavedRescheduleLink(
	ctx: ActionCtx,
	saved: RescheduleState & { timingUpdate: RescheduledSessionTimingUpdate }
) {
	return unlockRescheduleLink(ctx, {
		linkId: saved.link._id,
		lockedAt: saved.lockedAt,
		expiresAt: saved.timingUpdate.sessionStartAt
	}).map(() => saved);
}

export function saveClientRescheduleAndUnlockLink(
	ctx: ActionCtx,
	args: RescheduleSessionArgs,
	state: RescheduleState & { timingUpdate: RescheduledSessionTimingUpdate }
): ResultAsync<
	RescheduleState & { timingUpdate: RescheduledSessionTimingUpdate },
	RescheduleSessionError
> {
	return saveReschedule(ctx, args, state).andThen(
		(saved: RescheduleState & { timingUpdate: RescheduledSessionTimingUpdate }) =>
			unlockSavedRescheduleLink(ctx, saved)
	);
}

export function finishReschedule(
	session: Doc<"bookings">,
	args: RescheduleSessionArgs,
	timingUpdate: RescheduledSessionTimingUpdate,
	settings: SessionAvailabilitySettings
) {
	return sendBookingRescheduledEmailsForBooking(
		updatedRescheduledBooking(session, args, timingUpdate),
		{
			leadTimeMinutes: settings.leadTimeMinutes,
			originalDate: session.date,
			originalTime: session.time,
			rescheduleUrl: getRescheduleUrlForToken(args.token)
		}
	)
		.map(() => ({ bookingId: session._id }))
		.orElse(() => ok({ bookingId: session._id, warning: "RESCHEDULE_EMAIL_SEND_FAILED" as const }));
}
