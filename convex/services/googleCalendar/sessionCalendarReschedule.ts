"use node";

import { err, ok, okAsync, type ResultAsync } from "neverthrow";
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

function loadLink(
	ctx: ActionCtx,
	args: RescheduleSessionArgs
): ResultAsync<ValidRescheduleDetails, RescheduleSessionError> {
	const now = Date.now();

	return loadValidRescheduleLinkAndSession(ctx, { token: args.token, now }).andThen((details) =>
		getBookingSubmitRateLimitKey(details.session.email).andThen((submitRateLimitKey) =>
			checkBookingSubmitRateLimit(ctx, submitRateLimitKey).map(() => details)
		)
	);
}

function validateTarget(
	ctx: ActionCtx,
	args: RescheduleSessionArgs,
	details: ValidRescheduleDetails
) {
	return loadBookingAvailabilitySettings(ctx).andThen((settings) =>
		loadGoogleCalendarClient("GOOGLE_CALENDAR_AVAILABILITY_FAILED").andThen((calendarClient) =>
			validateRescheduleTiming(args, details.session, settings, calendarClient).andThen(() =>
				getSessionStartAt(args.date, args.time, calendarClient.timeZone).map((sessionStartAt) => ({
					calendarClient,
					details,
					sessionStartAt,
					settings
				}))
			)
		)
	);
}

export function loadRescheduleTargetAndValidate(ctx: ActionCtx, args: RescheduleSessionArgs) {
	return loadLink(ctx, args).andThen((details) => validateTarget(ctx, args, details));
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

export function lockAndReserve(
	ctx: ActionCtx,
	details: ValidRescheduleDetails,
	sessionStartAt: number,
	settings: SessionAvailabilitySettings
) {
	const lockedAt = Date.now();

	const unlockAndReturnReservationError = <Error extends { reason: string }>(
		reservationError: Error
	) => releaseRescheduleLink(ctx, details.link._id, lockedAt).andThen(() => err(reservationError));

	return lockRescheduleLink(ctx, { linkId: details.link._id, now: lockedAt }).andThen(() =>
		reserveSessionSlot(ctx, {
			bookingId: details.session._id,
			duration: details.session.duration,
			eventBufferMinutes: settings.eventBufferMinutes,
			sessionStartAt
		})
			.andThen((reservationResult) =>
				reservationResult.outcome === "unavailable"
					? err({ reason: "BOOKING_TIME_UNAVAILABLE" as const })
					: ok({
							link: details.link,
							lockedAt,
							reservation: reservationResult.reservation,
							session: details.session,
							settings
						})
			)
			.orElse(unlockAndReturnReservationError)
	);
}

function releaseRescheduleLink(
	ctx: ActionCtx,
	linkId: Doc<"bookingRescheduleLinks">["_id"],
	lockedAt: number
) {
	return unlockRescheduleLink(ctx, { linkId, lockedAt }).orElse((error) => {
		console.error("Reschedule link unlock failed", { linkId, error });

		return okAsync(null);
	});
}

function clearReservationThenUnlock(ctx: ActionCtx, state: RescheduleState) {
	return clearSessionSlotReservation(ctx, {
		bookingId: state.session._id,
		reservation: state.reservation
	})
		.orElse((error) => {
			console.error("Reschedule reservation cleanup failed", {
				bookingId: state.session._id,
				error
			});

			return okAsync(null);
		})
		.andThen(() => releaseRescheduleLink(ctx, state.link._id, state.lockedAt));
}

export function syncCalendar(
	ctx: ActionCtx,
	args: RescheduleSessionArgs,
	state: RescheduleState,
	calendarClient: ReturnType<typeof getGoogleCalendarClient>
) {
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
		.map((timingUpdate) => ({ ...state, timingUpdate }))
		.orElse((error) => clearReservationThenUnlock(ctx, state).andThen(() => err(error)));
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
		.map(() => state)
		.orElse((error) => clearReservationThenUnlock(ctx, state).andThen(() => err(error)));
}

export function saveClientRescheduleAndUnlockLink(
	ctx: ActionCtx,
	args: RescheduleSessionArgs,
	state: RescheduleState & { timingUpdate: RescheduledSessionTimingUpdate }
) {
	return saveReschedule(ctx, args, state).andThen((saved) =>
		unlockRescheduleLink(ctx, {
			linkId: saved.link._id,
			lockedAt: saved.lockedAt,
			expiresAt: saved.timingUpdate.sessionStartAt
		}).map(() => saved)
	);
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
		.map(() => ({ bookingId: session._id }))
		.orElse(() => ok({ bookingId: session._id, warning: "RESCHEDULE_EMAIL_SEND_FAILED" as const }));
}
