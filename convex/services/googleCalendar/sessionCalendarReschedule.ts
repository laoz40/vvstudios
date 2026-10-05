"use node";

import { err, errAsync, ok, okAsync, type ResultAsync } from "neverthrow";
import type { Doc } from "#convex/_generated/dataModel";
import type { ActionCtx } from "#convex/_generated/server";
import { loadBookingAvailabilitySettings } from "#convex/lib/booking/bookingConfirmationActionBoundaries";
import type { getGoogleCalendarClient } from "#convex/lib/googleCalendar/googleCalendarClient";
import { loadGoogleCalendarClient } from "#convex/lib/googleCalendar/googleCalendarClient";
import { getBookingSubmitRateLimitKey } from "#convex/lib/booking/bookingSubmission";
import { checkBookingSubmitRateLimit } from "#convex/lib/rateLimits";
import {
	clearSessionSlotReservation,
	loadValidRescheduleLinkAndSession,
	lockRescheduleLink,
	reserveSessionSlot,
	saveClientSessionReschedule,
	unlockRescheduleLink,
	type ValidRescheduleDetails as LibValidRescheduleDetails
} from "#convex/lib/sessions/sessionCalendarActionBoundaries";
import { updateSessionTimingWithGoogleCalendar } from "#convex/services/googleCalendar/sessionCalendarTimingSync";
import {
	getSessionStartAt,
	validateSessionTimingEdit
} from "#convex/lib/sessions/sessionAdminEdit";
import type { SessionAvailabilitySettings } from "#convex/lib/sessions/sessionCalendarTime";
import type { SaveClientSessionRescheduleArgs } from "#convex/lib/sessions/sessionSchedulingArgs";
import { getRescheduleUrlForToken } from "#convex/lib/sessions/sessionRescheduleLinks";
import { sendBookingRescheduledEmailsForBooking } from "#convex/services/sessions/sessionRescheduleEmails";
import { pickBookingAddonQuantities } from "#studio/features/booking-form/lib/booking-form-model";
import type { AdminSessionUpdateError } from "#convex/lib/sessions/sessionAdminEdit";
import type { RescheduleLinkLookupError } from "#convex/services/sessions/sessionReschedule";

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
	return () => details;
}

function enforceRescheduleSubmitRateLimitStep(ctx: ActionCtx, details: ValidRescheduleDetails) {
	return (submitRateLimitKey: string) =>
		checkBookingSubmitRateLimit(ctx, submitRateLimitKey).map(retainRescheduleDetailsStep(details));
}

function loadLinkWithRateLimitStep(ctx: ActionCtx) {
	return (details: ValidRescheduleDetails) =>
		getBookingSubmitRateLimitKey(details.session.email).andThen(
			enforceRescheduleSubmitRateLimitStep(ctx, details)
		);
}

function loadLink(
	ctx: ActionCtx,
	args: RescheduleSessionArgs
): ResultAsync<ValidRescheduleDetails, RescheduleSessionError> {
	const now = Date.now();

	return loadValidRescheduleLinkAndSession(ctx, { token: args.token, now }).andThen(
		loadLinkWithRateLimitStep(ctx)
	);
}

function validatedRescheduleTargetStep(
	_details: ValidRescheduleDetails,
	settings: SessionAvailabilitySettings,
	calendarClient: ReturnType<typeof getGoogleCalendarClient>
) {
	return (sessionStartAt: number) => ({
		calendarClient,
		details: _details,
		sessionStartAt,
		settings
	});
}

function validateRescheduleTargetForCalendarClientStep(
	args: RescheduleSessionArgs,
	details: ValidRescheduleDetails,
	settings: SessionAvailabilitySettings
) {
	return (calendarClient: ReturnType<typeof getGoogleCalendarClient>) =>
		validateRescheduleTiming(args, details.session, settings, calendarClient).andThen(
			afterRescheduleTimingValidatedStep(args, details, settings, calendarClient)
		);
}

function afterRescheduleTimingValidatedStep(
	args: RescheduleSessionArgs,
	details: ValidRescheduleDetails,
	settings: SessionAvailabilitySettings,
	calendarClient: ReturnType<typeof getGoogleCalendarClient>
) {
	return (_timingValidated: null) =>
		getSessionStartAt(args.date, args.time, calendarClient.timeZone).match(
			(sessionStartAt) =>
				okAsync(validatedRescheduleTargetStep(details, settings, calendarClient)(sessionStartAt)),
			(error) => errAsync(error)
		);
}

function validateRescheduleTargetWithSettingsStep(
	args: RescheduleSessionArgs,
	details: ValidRescheduleDetails
) {
	return (settings: SessionAvailabilitySettings) =>
		loadGoogleCalendarClient("GOOGLE_CALENDAR_AVAILABILITY_FAILED").andThen(
			validateRescheduleTargetForCalendarClientStep(args, details, settings)
		);
}

function validateTarget(
	ctx: ActionCtx,
	args: RescheduleSessionArgs,
	details: ValidRescheduleDetails
) {
	return loadBookingAvailabilitySettings(ctx).andThen(
		validateRescheduleTargetWithSettingsStep(args, details)
	);
}

function validateRescheduleTargetForDetailsStep(ctx: ActionCtx, args: RescheduleSessionArgs) {
	return (details: ValidRescheduleDetails) => validateTarget(ctx, args, details);
}

export function loadRescheduleTargetAndValidate(ctx: ActionCtx, args: RescheduleSessionArgs) {
	return loadLink(ctx, args).andThen(validateRescheduleTargetForDetailsStep(ctx, args));
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
	settings: SessionAvailabilitySettings
) {
	return (reservationResult: {
		outcome: "reserved" | "unavailable";
		reservation?: RescheduleReservation;
	}) =>
		reservationResult.outcome === "unavailable"
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
	sessionStartAt: number
) {
	return (_linkLocked: null) =>
		reserveSessionSlot(ctx, {
			bookingId: details.session._id,
			duration: details.session.duration,
			eventBufferMinutes: settings.eventBufferMinutes,
			sessionStartAt
		}).andThen(reservedRescheduleStateStep(details, lockedAt, settings));
}

export function attachCalendarClientToLockState(
	calendarClient: ReturnType<typeof getGoogleCalendarClient>
) {
	return (state: RescheduleState) => ({ calendarClient, state });
}

function rethrowReservationErrorStep<Error extends { reason: string }>(reservationError: Error) {
	return () => err(reservationError);
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
	) =>
		releaseRescheduleLink(ctx, details.link._id, lockedAt).andThen(
			rethrowReservationErrorStep(reservationError)
		);

	return lockRescheduleLink(ctx, { linkId: details.link._id, now: lockedAt })
		.andThen(reserveSessionSlotAfterLockStep(ctx, details, lockedAt, settings, sessionStartAt))
		.orElse(unlockAndReturnReservationError);
}

function releaseRescheduleLink(
	ctx: ActionCtx,
	linkId: Doc<"bookingRescheduleLinks">["_id"],
	lockedAt: number
) {
	return unlockRescheduleLink(ctx, { linkId, lockedAt }).orElse(
		logRescheduleUnlockFailureStep(linkId)
	);
}

function logRescheduleUnlockFailureStep(linkId: Doc<"bookingRescheduleLinks">["_id"]) {
	return (error: { reason: string }) => {
		console.error("Reschedule link unlock failed", { linkId, error });

		return okAsync(null);
	};
}

function clearReservationThenUnlockStep(ctx: ActionCtx, state: RescheduleState) {
	return (_reservationCleared: { cleared: boolean } | null) =>
		releaseRescheduleLink(ctx, state.link._id, state.lockedAt);
}

function clearReservationThenUnlock(ctx: ActionCtx, state: RescheduleState) {
	return clearSessionSlotReservation(ctx, {
		bookingId: state.session._id,
		reservation: state.reservation
	})
		.orElse(logRescheduleReservationCleanupFailureStep(state.session._id))
		.andThen(clearReservationThenUnlockStep(ctx, state));
}

function logRescheduleReservationCleanupFailureStep(bookingId: Doc<"bookings">["_id"]) {
	return (error: { reason: string }) => {
		console.error("Reschedule reservation cleanup failed", { bookingId, error });

		return okAsync(null);
	};
}

function rescheduleStateWithTimingUpdateStep(state: RescheduleState) {
	return (timingUpdate: RescheduledSessionTimingUpdate) => ({ ...state, timingUpdate });
}

function rethrowRescheduleErrorStep<Error extends RescheduleSessionError>(error: Error) {
	return () => err(error);
}

function rollbackRescheduleOnCalendarErrorStep(ctx: ActionCtx, state: RescheduleState) {
	return (error: RescheduleSessionError) =>
		clearReservationThenUnlock(ctx, state).andThen(rethrowRescheduleErrorStep(error));
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
		.map(rescheduleStateWithTimingUpdateStep(state))
		.orElse(rollbackRescheduleOnCalendarErrorStep(ctx, state));
}

function retainRescheduleStateStep(
	state: RescheduleState & { timingUpdate: RescheduledSessionTimingUpdate }
) {
	return () => state;
}

function rollbackRescheduleOnSaveErrorStep(
	ctx: ActionCtx,
	state: RescheduleState & { timingUpdate: RescheduledSessionTimingUpdate }
) {
	return (error: RescheduleSessionError) =>
		clearReservationThenUnlock(ctx, state).andThen(rethrowRescheduleErrorStep(error));
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
		.map(retainRescheduleStateStep(state))
		.orElse(rollbackRescheduleOnSaveErrorStep(ctx, state));
}

function unlockSavedRescheduleLinkStep(ctx: ActionCtx) {
	return (saved: RescheduleState & { timingUpdate: RescheduledSessionTimingUpdate }) =>
		unlockRescheduleLink(ctx, {
			linkId: saved.link._id,
			lockedAt: saved.lockedAt,
			expiresAt: saved.timingUpdate.sessionStartAt
		}).map(retainValueStep(saved));
}

function retainValueStep<T>(value: T) {
	return () => value;
}

export function saveClientRescheduleAndUnlockLink(
	ctx: ActionCtx,
	args: RescheduleSessionArgs,
	state: RescheduleState & { timingUpdate: RescheduledSessionTimingUpdate }
): ResultAsync<
	RescheduleState & { timingUpdate: RescheduledSessionTimingUpdate },
	RescheduleSessionError
> {
	return saveReschedule(ctx, args, state).andThen(unlockSavedRescheduleLinkStep(ctx));
}

function rescheduleBookingIdStep(session: Doc<"bookings">) {
	return () => ({ bookingId: session._id });
}

function rescheduleBookingIdWithEmailWarningStep(session: Doc<"bookings">) {
	return () => ok({ bookingId: session._id, warning: "RESCHEDULE_EMAIL_SEND_FAILED" as const });
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
		.map(rescheduleBookingIdStep(session))
		.orElse(rescheduleBookingIdWithEmailWarningStep(session));
}
