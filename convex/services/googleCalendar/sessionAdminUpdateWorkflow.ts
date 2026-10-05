"use node";

import type { calendar_v3 } from "googleapis/build/src/apis/calendar/v3";
import { err, ok, okAsync } from "neverthrow";
import type { Doc } from "#convex/_generated/dataModel";
import type { ActionCtx } from "#convex/_generated/server";
import {
	clearSessionSlotReservation,
	reserveSessionSlot,
	saveAdminSessionUpdate
} from "#convex/lib/sessions/sessionCalendarActionBoundaries";
import {
	updateSessionTimingWithGoogleCalendar,
	type AdminSessionGoogleCalendarClient
} from "#convex/services/googleCalendar/sessionCalendarTimingSync";
import {
	calendarErrorSchema,
	calendarResultAsync,
	mapCalendarErrorCode
} from "#convex/lib/googleCalendar/googleCalendarErrors";
import { tryPromise } from "#convex/lib/result";
import type { SaveAdminSessionUpdateArgs } from "#convex/lib/sessions/sessionSchedulingArgs";
import { pickBookingAddonQuantities } from "#studio/features/booking-form/lib/booking-form-model";
import { removeOrphanedSessionCalendarEvent } from "#convex/lib/googleCalendar/googleCalendarEventCalls";
import { buildSessionCalendarEventPayload } from "#convex/lib/sessions/sessionCalendarEventPayload";
import type { SessionAvailabilitySettings } from "#convex/lib/sessions/sessionCalendarTime";
import type { SessionReservation } from "#convex/lib/sessions/sessionReservations";
import {
	didSessionTimingChange,
	getSessionEditFieldChanges,
	getSessionStartAt,
	type AdminSessionUpdateArgs,
	type AdminSessionUpdateResult,
	validateSessionTimingEdit,
	verifySessionCanBeScheduled
} from "#convex/lib/sessions/sessionAdminEdit";
import { notifyHostOfAdminSessionReschedule } from "#convex/lib/sessions/sessionHostEmails";

function eventDetails(args: AdminSessionUpdateArgs) {
	return {
		addons: args.addons,
		duration: args.duration,
		email: args.email,
		name: args.name,
		service: args.service,
		...pickBookingAddonQuantities(args)
	};
}

function verifyFailedSessionNewSlot({
	args,
	session,
	client,
	settings
}: {
	args: AdminSessionUpdateArgs;
	session: Doc<"bookings">;
	client: AdminSessionGoogleCalendarClient;
	settings: SessionAvailabilitySettings;
}) {
	return verifySessionCanBeScheduled({
		session: { ...session, date: args.date, duration: args.duration, time: args.time },
		calendar: client.calendar,
		calendarIds: client.calendarIds,
		settings,
		timeZone: client.timeZone
	}).andThen((canBeScheduled) =>
		canBeScheduled ? ok(undefined) : err({ reason: "BOOKING_TIME_UNAVAILABLE" as const })
	);
}

function buildFailedSessionGoogleEventPayload({
	args,
	client
}: {
	args: AdminSessionUpdateArgs;
	client: AdminSessionGoogleCalendarClient;
}) {
	return tryPromise({
		try: () =>
			Promise.resolve(
				buildSessionCalendarEventPayload({
					date: args.date,
					details: eventDetails(args),
					time: args.time,
					timeZone: client.timeZone
				})
			),
		catch: (error) => {
			const parsedError = calendarErrorSchema.safeParse(error);

			return {
				reason: parsedError.success
					? mapCalendarErrorCode(parsedError.data, "GOOGLE_CALENDAR_CREATE_FAILED")
					: "GOOGLE_CALENDAR_CREATE_FAILED"
			};
		}
	}).andThen((payloadResult) =>
		payloadResult.mapErr(() => ({ reason: "BOOKING_INVALID_INPUT" as const }))
	);
}

function insertFailedSessionGoogleEvent({
	client,
	requestBody
}: {
	client: AdminSessionGoogleCalendarClient;
	requestBody: calendar_v3.Schema$Event;
}) {
	return calendarResultAsync(
		client.calendar.events.insert({
			calendarId: client.calendarId,
			sendUpdates: "all",
			requestBody
		}),
		"GOOGLE_CALENDAR_CREATE_FAILED"
	);
}

function savePromotedFailedSession({
	args,
	session,
	client,
	ctx,
	googleEventId,
	reservation
}: {
	args: AdminSessionUpdateArgs;
	session: Doc<"bookings">;
	client: AdminSessionGoogleCalendarClient;
	ctx: ActionCtx;
	googleEventId: string | undefined;
	reservation?: SessionReservation;
}) {
	const saveArgs: SaveAdminSessionUpdateArgs = {
		...args,
		confirmBooking: true,
		googleCalendarId: client.calendarId,
		googleEventId
	};

	if (reservation) {
		saveArgs.reservation = reservation;
	}

	return saveAdminSessionUpdate(ctx, saveArgs).orElse((saveError) => {
		const shouldRemoveOrphanedEvent =
			saveError.reason === "BOOKING_TIME_UNAVAILABLE" || saveError.reason === "BOOKING_NOT_FOUND";

		if (!shouldRemoveOrphanedEvent || googleEventId === undefined) {
			return err(saveError);
		}

		return removeOrphanedSessionCalendarEvent({
			bookingId: session._id,
			calendar: client.calendar,
			calendarId: client.calendarId,
			googleEventId
		})
			.orElse(() => okAsync(undefined))
			.andThen(() => err(saveError));
	});
}

function promoteFailedSession({
	args,
	session,
	client,
	ctx,
	reservation,
	settings
}: {
	args: AdminSessionUpdateArgs;
	session: Doc<"bookings">;
	client: AdminSessionGoogleCalendarClient;
	ctx: ActionCtx;
	reservation?: SessionReservation;
	settings: SessionAvailabilitySettings;
}) {
	return verifyFailedSessionNewSlot({ args, session, client, settings })
		.andThen(() => buildFailedSessionGoogleEventPayload({ args, client }))
		.andThen((requestBody) =>
			insertFailedSessionGoogleEvent({ client, requestBody }).andThen((createdEvent) => {
				const googleEventId = createdEvent.data.id ?? undefined;

				return savePromotedFailedSession({
					args,
					session,
					client,
					ctx,
					googleEventId,
					reservation
				});
			})
		)
		.map(() => ({ googleOutcome: "createdFromFailed" as const }));
}

function saveAdminFieldsOnly({
	args,
	ctx,
	reservation
}: {
	args: AdminSessionUpdateArgs;
	ctx: ActionCtx;
	reservation?: SessionReservation;
}) {
	const saveArgs: SaveAdminSessionUpdateArgs = { ...args };

	if (reservation) {
		saveArgs.reservation = reservation;
	}

	return saveAdminSessionUpdate(ctx, saveArgs).map(() => ({}));
}

function shouldSyncConfirmedToGoogle(session: Doc<"bookings">, args: AdminSessionUpdateArgs) {
	const fieldChanges = getSessionEditFieldChanges(session, args);

	return fieldChanges.timingFieldsChanged || fieldChanges.googleEventFieldsChanged;
}

function updateConfirmedGoogleEvent({
	args,
	session,
	client,
	ctx,
	reservation,
	settings
}: {
	args: AdminSessionUpdateArgs;
	session: Doc<"bookings">;
	client: AdminSessionGoogleCalendarClient;
	ctx: ActionCtx;
	reservation?: SessionReservation;
	settings: SessionAvailabilitySettings;
}) {
	return updateSessionTimingWithGoogleCalendar({
		bypassAvailabilitySettings: true,
		session,
		client,
		date: args.date,
		details: eventDetails(args),
		duration: args.duration,
		settings,
		time: args.time
	}).andThen((timingUpdate) => {
		if (!timingUpdate.googleEventId && !timingUpdate.googleCalendarId) {
			return ok(null);
		}

		const saveArgs: SaveAdminSessionUpdateArgs = {
			...args,
			googleCalendarId: timingUpdate.googleCalendarId,
			googleEventId: timingUpdate.googleEventId
		};

		if (reservation) {
			saveArgs.reservation = reservation;
		}

		return saveAdminSessionUpdate(ctx, saveArgs).map(() => ({
			googleOutcome: timingUpdate.outcome
		}));
	});
}

function syncAdminSessionGoogleAndSave({
	args,
	session,
	client,
	ctx,
	reservation,
	settings
}: {
	args: AdminSessionUpdateArgs;
	session: Doc<"bookings">;
	client: AdminSessionGoogleCalendarClient;
	ctx: ActionCtx;
	reservation?: SessionReservation;
	settings: SessionAvailabilitySettings;
}) {
	if (session.status === "failed") {
		return promoteFailedSession({ args, session, client, ctx, reservation, settings });
	}

	if (session.status !== "confirmed" && session.status !== "email_failed") {
		return validateSessionTimingEdit({
			bypassAvailabilitySettings: true,
			calendar: client.calendar,
			calendarIds: client.calendarIds,
			existing: {
				date: session.date,
				duration: session.duration,
				googleCalendarId: session.googleCalendarId,
				googleEventId: session.googleEventId,
				time: session.time
			},
			next: { date: args.date, duration: args.duration, time: args.time },
			settings,
			timeZone: client.timeZone
		}).andThen(() => saveAdminFieldsOnly({ args, ctx, reservation }));
	}

	if (!shouldSyncConfirmedToGoogle(session, args)) {
		return saveAdminFieldsOnly({ args, ctx, reservation });
	}

	return updateConfirmedGoogleEvent({ args, session, client, ctx, reservation, settings }).andThen(
		(replacementOutcome) => {
			if (replacementOutcome) {
				return ok(replacementOutcome);
			}

			return saveAdminFieldsOnly({ args, ctx, reservation });
		}
	);
}

function reserveSlotForAdminTimingChange(
	ctx: ActionCtx,
	args: AdminSessionUpdateArgs,
	session: Doc<"bookings">,
	client: AdminSessionGoogleCalendarClient,
	settings: SessionAvailabilitySettings
) {
	return getSessionStartAt(args.date, args.time, client.timeZone).asyncAndThen((sessionStartAt) =>
		reserveSessionSlot(ctx, {
			bookingId: session._id,
			duration: args.duration,
			eventBufferMinutes: settings.eventBufferMinutes,
			sessionStartAt
		}).andThen((reservationResult) => {
			if (reservationResult.outcome === "unavailable") {
				return err({ reason: "BOOKING_TIME_UNAVAILABLE" as const });
			}

			return ok(reservationResult.reservation);
		})
	);
}

function withReservationCompensation(
	ctx: ActionCtx,
	session: Doc<"bookings">,
	reservation: SessionReservation,
	update: () => ReturnType<typeof syncAdminSessionGoogleAndSave>
) {
	return update().orElse((error) =>
		clearSessionSlotReservation(ctx, { bookingId: session._id, reservation }).andThen(() =>
			err(error)
		)
	);
}

export function persistAdminSessionGoogleUpdate({
	args,
	session,
	client,
	ctx,
	settings
}: {
	args: AdminSessionUpdateArgs;
	session: Doc<"bookings">;
	client: AdminSessionGoogleCalendarClient;
	ctx: ActionCtx;
	settings: SessionAvailabilitySettings;
}): ReturnType<typeof syncAdminSessionGoogleAndSave> {
	if (!didSessionTimingChange(session, args)) {
		return syncAdminSessionGoogleAndSave({ args, session, client, ctx, settings });
	}

	return reserveSlotForAdminTimingChange(ctx, args, session, client, settings).andThen(
		(reservation) =>
			withReservationCompensation(ctx, session, reservation, () =>
				syncAdminSessionGoogleAndSave({ args, session, client, ctx, reservation, settings })
			)
	);
}

export function notifyHostIfNeeded(
	ctx: ActionCtx,
	args: AdminSessionUpdateArgs,
	session: Doc<"bookings">,
	settings: SessionAvailabilitySettings,
	result: AdminSessionUpdateResult
) {
	const shouldSendHostRescheduleEmail =
		didSessionTimingChange(session, args) &&
		(session.status === "confirmed" || session.status === "email_failed");

	if (!shouldSendHostRescheduleEmail || result.googleOutcome === "createdFromFailed") {
		return okAsync(result);
	}

	return notifyHostOfAdminSessionReschedule(ctx, {
		bookingId: args.bookingId,
		leadTimeMinutes: settings.leadTimeMinutes,
		originalDate: session.date,
		originalTime: session.time,
		result
	});
}
