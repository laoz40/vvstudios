"use node";

import { err, errAsync, ok, okAsync, type ResultAsync } from "neverthrow";
import type { Doc } from "#convex/_generated/dataModel";
import type { ActionCtx } from "#convex/_generated/server";
import { loadBookingAvailabilitySettings } from "#convex/booking/lib/bookingConfirmationActionBoundaries";
import type { getGoogleCalendarClient } from "#convex/googleCalendar/lib/googleCalendarClient";
import { loadGoogleCalendarClient } from "#convex/googleCalendar/lib/googleCalendarClient";
import { getBookingSubmitRateLimitKey } from "#convex/booking/lib/bookingSubmission";
import { checkBookingSubmitRateLimit } from "#convex/shared/lib/rateLimits";
import {
	clearSessionSlotReservation,
	loadValidRescheduleLinkAndSession,
	lockRescheduleLink,
	reserveSessionSlot,
	saveClientSessionReschedule,
	unlockRescheduleLink,
	type ValidRescheduleDetails as LibValidRescheduleDetails
} from "#convex/sessions/lib/sessionCalendarActionBoundaries";
import { updateSessionTimingWithGoogleCalendar } from "#convex/googleCalendar/services/sessionCalendarTimingSync";
import {
	getSessionStartAt,
	validateSessionTimingEdit
} from "#convex/sessions/lib/sessionAdminEdit";
import type { SessionAvailabilitySettings } from "#convex/sessions/lib/sessionCalendarTime";
import type { SaveClientSessionRescheduleArgs } from "#convex/sessions/lib/sessionSchedulingArgs";
import { getRescheduleUrlForToken } from "#convex/sessions/lib/sessionRescheduleLinks";
import { sendBookingRescheduledEmailsForBooking } from "#convex/sessions/services/sessionRescheduleEmails";
import { pickBookingAddonQuantities } from "#/domain/booking/addon-quantities";
import type { AdminSessionUpdateError } from "#convex/sessions/lib/sessionAdminEdit";
import type { RescheduleLinkLookupError } from "#convex/sessions/lib/sessionRescheduleLinks";

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

function retainRescheduleDetailsStep(details: ValidRescheduleDetails) {
	return details;
}

function enforceRescheduleSubmitRateLimitStep(
	ctx: ActionCtx,
	details: ValidRescheduleDetails,
	submitRateLimitKey: string
) {
	return checkBookingSubmitRateLimit(ctx, submitRateLimitKey).map(() =>
		retainRescheduleDetailsStep(details)
	);
}

function loadLinkWithRateLimitStep(ctx: ActionCtx, details: ValidRescheduleDetails) {
	return getBookingSubmitRateLimitKey(details.session.email).andThen((submitRateLimitKey: string) =>
		enforceRescheduleSubmitRateLimitStep(ctx, details, submitRateLimitKey)
	);
}

function loadLink(
	ctx: ActionCtx,
	args: RescheduleSessionArgs
): ResultAsync<ValidRescheduleDetails, RescheduleSessionError> {
	const now = Date.now();

	return loadValidRescheduleLinkAndSession(ctx, { token: args.token, now }).andThen(
		(details: ValidRescheduleDetails) => loadLinkWithRateLimitStep(ctx, details)
	);
}

function validatedRescheduleTargetStep(
	_details: ValidRescheduleDetails,
	settings: SessionAvailabilitySettings,
	calendarClient: ReturnType<typeof getGoogleCalendarClient>,

	sessionStartAt: number
) {
	return { calendarClient, details: _details, sessionStartAt, settings };
}

function validateRescheduleTargetForCalendarClientStep(
	args: RescheduleSessionArgs,
	details: ValidRescheduleDetails,
	settings: SessionAvailabilitySettings,

	calendarClient: ReturnType<typeof getGoogleCalendarClient>
) {
	return validateRescheduleTiming(args, details.session, settings, calendarClient).andThen(
		(_timingValidated: null) =>
			afterRescheduleTimingValidatedStep(args, details, settings, calendarClient, _timingValidated)
	);
}

function afterRescheduleTimingValidatedStep(
	args: RescheduleSessionArgs,
	details: ValidRescheduleDetails,
	settings: SessionAvailabilitySettings,
	calendarClient: ReturnType<typeof getGoogleCalendarClient>,
	_timingValidated: null
) {
	return getSessionStartAt(args.date, args.time, calendarClient.timeZone).match(
		(sessionStartAt) =>
			okAsync(validatedRescheduleTargetStep(details, settings, calendarClient, sessionStartAt)),
		(error) => errAsync(error)
	);
}

function validateRescheduleTargetWithSettingsStep(
	args: RescheduleSessionArgs,
	details: ValidRescheduleDetails,

	settings: SessionAvailabilitySettings
) {
	return loadGoogleCalendarClient("GOOGLE_CALENDAR_AVAILABILITY_FAILED").andThen(
		(calendarClient: ReturnType<typeof getGoogleCalendarClient>) =>
			validateRescheduleTargetForCalendarClientStep(args, details, settings, calendarClient)
	);
}

function validateTarget(
	ctx: ActionCtx,
	args: RescheduleSessionArgs,
	details: ValidRescheduleDetails
) {
	return loadBookingAvailabilitySettings(ctx).andThen((settings: SessionAvailabilitySettings) =>
		validateRescheduleTargetWithSettingsStep(args, details, settings)
	);
}

function validateRescheduleTargetForDetailsStep(
	ctx: ActionCtx,
	args: RescheduleSessionArgs,
	details: ValidRescheduleDetails
) {
	return validateTarget(ctx, args, details);
}

export function loadRescheduleTargetAndValidate(ctx: ActionCtx, args: RescheduleSessionArgs) {
	return loadLink(ctx, args).andThen((details: ValidRescheduleDetails) =>
		validateRescheduleTargetForDetailsStep(ctx, args, details)
	);
}

export function validateRescheduleTiming(
	args: RescheduleSessionArgs,
	session: Doc<"bookings">,
	settings: SessionAvailabilitySettings,
	calendarClient: ReturnType<typeof getGoogleCalendarClient>
) {
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

function reservedRescheduleStateStep(
	details: ValidRescheduleDetails,
	lockedAt: number,
	settings: SessionAvailabilitySettings,

	reservationResult: { outcome: "reserved" | "unavailable"; reservation?: RescheduleReservation }
) {
	return reservationResult.outcome === "unavailable"
		? errAsync({ reason: "BOOKING_TIME_UNAVAILABLE" as const })
		: okAsync({
				link: details.link,
				lockedAt,
				reservation: reservationResult.reservation!,
				session: details.session,
				settings
			});
}

function reserveSessionSlotAfterLockStep(
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
		(reservationResult: {
			outcome: "reserved" | "unavailable";
			reservation?: RescheduleReservation;
		}) => reservedRescheduleStateStep(details, lockedAt, settings, reservationResult)
	);
}

export function attachCalendarClientToLockState(
	calendarClient: ReturnType<typeof getGoogleCalendarClient>,

	state: RescheduleState
) {
	return { calendarClient, state };
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
			reserveSessionSlotAfterLockStep(ctx, details, lockedAt, settings, sessionStartAt, _linkLocked)
		)
		.orElse(unlockAndReturnReservationError);
}

function releaseRescheduleLink(
	ctx: ActionCtx,
	linkId: Doc<"bookingRescheduleLinks">["_id"],
	lockedAt: number
) {
	return unlockRescheduleLink(ctx, { linkId, lockedAt }).orElse((error: { reason: string }) =>
		logRescheduleUnlockFailureStep(linkId, error)
	);
}

function logRescheduleUnlockFailureStep(
	linkId: Doc<"bookingRescheduleLinks">["_id"],
	error: { reason: string }
) {
	console.error("Reschedule link unlock failed", { linkId, error });

	return okAsync(null);
}

function clearReservationThenUnlockStep(
	ctx: ActionCtx,
	state: RescheduleState,
	_reservationCleared: { cleared: boolean } | null
) {
	return releaseRescheduleLink(ctx, state.link._id, state.lockedAt);
}

function clearReservationThenUnlock(ctx: ActionCtx, state: RescheduleState) {
	return clearSessionSlotReservation(ctx, {
		bookingId: state.session._id,
		reservation: state.reservation
	})
		.orElse((error: { reason: string }) =>
			logRescheduleReservationCleanupFailureStep(state.session._id, error)
		)
		.andThen((_reservationCleared: { cleared: boolean } | null) =>
			clearReservationThenUnlockStep(ctx, state, _reservationCleared)
		);
}

function logRescheduleReservationCleanupFailureStep(
	bookingId: Doc<"bookings">["_id"],
	error: { reason: string }
) {
	console.error("Reschedule reservation cleanup failed", { bookingId, error });

	return okAsync(null);
}

function rescheduleStateWithTimingUpdateStep(
	state: RescheduleState,
	timingUpdate: RescheduledSessionTimingUpdate
) {
	return { ...state, timingUpdate };
}

function rollbackRescheduleOnCalendarErrorStep(
	ctx: ActionCtx,
	state: RescheduleState,
	error: RescheduleSessionError
) {
	return clearReservationThenUnlock(ctx, state).andThen(() => err(error));
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
	return updateSessionTimingWithGoogleCalendar({
		session: state.session,
		client: calendarClient,
		date: args.date,
		details: {
			addons: state.session.addons,
			duration: state.session.duration,
			email: state.session.email,
			name: state.session.name,
			service: state.session.service,
			...pickBookingAddonQuantities(state.session)
		},
		duration: state.session.duration,
		createMissingEvent: state.session.status === "failed",
		settings: state.settings,
		time: args.time
	})
		.map((timingUpdate: RescheduledSessionTimingUpdate) =>
			rescheduleStateWithTimingUpdateStep(state, timingUpdate)
		)
		.orElse((error: RescheduleSessionError) =>
			rollbackRescheduleOnCalendarErrorStep(ctx, state, error)
		);
}

function retainRescheduleStateStep(
	state: RescheduleState & { timingUpdate: RescheduledSessionTimingUpdate }
) {
	return state;
}

function rollbackRescheduleOnSaveErrorStep(
	ctx: ActionCtx,
	state: RescheduleState & { timingUpdate: RescheduledSessionTimingUpdate },

	error: RescheduleSessionError
) {
	return clearReservationThenUnlock(ctx, state).andThen(() => err(error));
}

function saveReschedule(
	ctx: ActionCtx,
	args: RescheduleSessionArgs,
	state: RescheduleState & { timingUpdate: RescheduledSessionTimingUpdate }
) {
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

	return saveClientSessionReschedule(ctx, saveArgs)
		.map(() => retainRescheduleStateStep(state))
		.orElse((error: RescheduleSessionError) =>
			rollbackRescheduleOnSaveErrorStep(ctx, state, error)
		);
}

function unlockSavedRescheduleLinkStep(
	ctx: ActionCtx,
	saved: RescheduleState & { timingUpdate: RescheduledSessionTimingUpdate }
) {
	return unlockRescheduleLink(ctx, {
		linkId: saved.link._id,
		lockedAt: saved.lockedAt,
		expiresAt: saved.timingUpdate.sessionStartAt
	}).map(() => retainValueStep(saved));
}

function retainValueStep<T>(value: T) {
	return value;
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
			unlockSavedRescheduleLinkStep(ctx, saved)
	);
}

function rescheduleBookingIdStep(session: Doc<"bookings">) {
	return { bookingId: session._id };
}

function rescheduleBookingIdWithEmailWarningStep(session: Doc<"bookings">) {
	return ok({ bookingId: session._id, warning: "RESCHEDULE_EMAIL_SEND_FAILED" as const });
}

export function finishReschedule(
	session: Doc<"bookings">,
	args: RescheduleSessionArgs,
	timingUpdate: RescheduledSessionTimingUpdate,
	settings: SessionAvailabilitySettings
) {
	const updatedBooking = {
		...session,
		date: args.date,
		time: args.time,
		sessionStartAt: timingUpdate.sessionStartAt,
		googleCalendarId: timingUpdate.googleCalendarId ?? session.googleCalendarId,
		googleEventId: timingUpdate.googleEventId ?? session.googleEventId
	};

	return sendBookingRescheduledEmailsForBooking(updatedBooking, {
		leadTimeMinutes: settings.leadTimeMinutes,
		originalDate: session.date,
		originalTime: session.time,
		rescheduleUrl: getRescheduleUrlForToken(args.token)
	})
		.map(() => rescheduleBookingIdStep(session))
		.orElse(() => rescheduleBookingIdWithEmailWarningStep(session));
}
