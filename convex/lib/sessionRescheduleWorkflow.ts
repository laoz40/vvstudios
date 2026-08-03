"use node";

import { err, ok, ResultAsync } from "neverthrow";
import { internal } from "#convex/_generated/api";
import type { Doc } from "#convex/_generated/dataModel";
import type { ActionCtx } from "#convex/_generated/server";
import type { getGoogleCalendarClient } from "#convex/lib/googleCalendarClient";
import {
	updateSessionTimingWithGoogleCalendar,
	validateSessionTimingEdit
} from "#convex/lib/sessionAdminEdit";
import type { SessionAvailabilitySettings } from "#convex/lib/sessionCalendarTime";
import { fromConvexTuple } from "#convex/lib/result";

export type RescheduleSessionArgs = { date: string; time: string; token: string };
export type ValidRescheduleDetails = {
	session: Doc<"bookings">;
	link: Doc<"bookingRescheduleLinks">;
};

type RescheduleReservation = { reservedAt: number; sessionStartAt: number; duration: string };

type RescheduleState = {
	link: Doc<"bookingRescheduleLinks">;
	lockedAt: number;
	reservation: RescheduleReservation;
	session: Doc<"bookings">;
	settings: SessionAvailabilitySettings;
};

export function validateRescheduleTiming(
	args: RescheduleSessionArgs,
	session: Doc<"bookings">,
	settings: SessionAvailabilitySettings,
	calendarClient: ReturnType<typeof getGoogleCalendarClient>
) {
	return ResultAsync.fromSafePromise(
		validateSessionTimingEdit({
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
		})
	).andThen((result) => result);
}

export function lockAndReserveReschedule(
	ctx: ActionCtx,
	details: ValidRescheduleDetails,
	sessionStartAt: number,
	settings: SessionAvailabilitySettings
) {
	const lockedAt = Date.now();

	const unlockAndReturnReservationError = <Error extends { reason: string }>(
		reservationError: Error
	) => releaseRescheduleLink(ctx, details.link._id, lockedAt).andThen(() => err(reservationError));

	return fromConvexTuple(
		ctx.runMutation(internal.sessionReschedule.lockRescheduleLink, {
			linkId: details.link._id,
			now: lockedAt
		})
	).andThen(() =>
		fromConvexTuple(
			ctx.runMutation(internal.sessionScheduling.reserveSessionReservation, {
				bookingId: details.session._id,
				duration: details.session.duration,
				eventBufferMinutes: settings.eventBufferMinutes,
				now: Date.now(),
				sessionStartAt
			})
		)
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
	return ResultAsync.fromPromise(
		fromConvexTuple(
			ctx.runMutation(internal.sessionReschedule.unlockRescheduleLink, { linkId, lockedAt })
		).match(
			() => null,
			(error) => {
				console.error("Reschedule link unlock failed", { linkId, error });
				return null;
			}
		),
		(error) => error
	)
		.mapErr((error) => {
			console.error("Reschedule link unlock failed", { linkId, error });
			return error;
		})
		.orElse(() => ok(null));
}

function clearReservationThenUnlock(ctx: ActionCtx, state: RescheduleState) {
	return ResultAsync.fromPromise(
		ctx
			.runMutation(internal.sessionScheduling.clearSessionReservation, {
				bookingId: state.session._id,
				reservation: state.reservation
			})
			.then(() => null),
		(error) => error
	)
		.mapErr((error) => {
			console.error("Session reservation cleanup failed", { bookingId: state.session._id, error });
			return error;
		})
		.orElse(() => ok(null))
		.andThen(() => releaseRescheduleLink(ctx, state.link._id, state.lockedAt));
}

export function updateRescheduleCalendar(
	ctx: ActionCtx,
	args: RescheduleSessionArgs,
	state: RescheduleState,
	calendarClient: ReturnType<typeof getGoogleCalendarClient>
) {
	return ResultAsync.fromSafePromise(
		updateSessionTimingWithGoogleCalendar({
			session: state.session,
			client: calendarClient,
			date: args.date,
			details: {
				addons: state.session.addons,
				duration: state.session.duration,
				email: state.session.email,
				name: state.session.name,
				service: state.session.service
			},
			duration: state.session.duration,
			createMissingEvent: state.session.status === "failed",
			settings: state.settings,
			time: args.time
		})
	)
		.andThen((result) => result)
		.map((timingUpdate) => ({ ...state, timingUpdate }))
		.orElse((error) => clearReservationThenUnlock(ctx, state).andThen(() => err(error)));
}

export function saveRescheduledSession(
	ctx: ActionCtx,
	args: RescheduleSessionArgs,
	state: RescheduleState & {
		timingUpdate: { googleCalendarId?: string; googleEventId?: string; sessionStartAt: number };
	}
) {
	return fromConvexTuple(
		ctx.runMutation(internal.sessionScheduling.saveClientSessionReschedule, {
			bookingId: state.session._id,
			date: args.date,
			time: args.time,
			sessionStartAt: state.timingUpdate.sessionStartAt,
			confirmBooking: state.session.status === "failed",
			reservation: state.reservation,
			...(state.timingUpdate.googleCalendarId
				? { googleCalendarId: state.timingUpdate.googleCalendarId }
				: {}),
			...(state.timingUpdate.googleEventId
				? { googleEventId: state.timingUpdate.googleEventId }
				: {})
		})
	)
		.map(() => state)
		.orElse((error) => clearReservationThenUnlock(ctx, state).andThen(() => err(error)));
}
