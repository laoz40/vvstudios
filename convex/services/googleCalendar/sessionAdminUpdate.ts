"use node";

import type { calendar_v3 } from "googleapis/build/src/apis/calendar/v3";
import { err, errAsync, ok, okAsync, type ResultAsync } from "neverthrow";
import type { Doc, Id } from "#convex/_generated/dataModel";
import type { ActionCtx } from "#convex/_generated/server";
import { loadBookingAvailabilitySettings } from "#convex/lib/booking/bookingConfirmationActionBoundaries";
import { loadGoogleCalendarClient } from "#convex/lib/googleCalendar/googleCalendarClient";
import { getSessionFromQuery } from "#convex/services/sessions/sessionLookup";
import { requirePermissionActions } from "#convex/services/requirePermissionActions";
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
	type AdminSessionUpdateError,
	type AdminSessionUpdateResult as LibAdminSessionUpdateResult,
	validateSessionTimingEdit,
	verifySessionCanBeScheduled
} from "#convex/lib/sessions/sessionAdminEdit";
import { notifyHostOfAdminSessionReschedule } from "#convex/services/sessions/sessionRescheduleEmails";

export type AdminSessionUpdateResult = LibAdminSessionUpdateResult;

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

function requireSchedulableFailedSessionStep(canBeScheduled: boolean) {
	return canBeScheduled ? ok(undefined) : err({ reason: "BOOKING_TIME_UNAVAILABLE" as const });
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
	}).andThen(requireSchedulableFailedSessionStep);
}

function mapFailedSessionPayloadResultStep(
	payloadResult: ReturnType<typeof buildSessionCalendarEventPayload>
) {
	return payloadResult.mapErr(() => ({ reason: "BOOKING_INVALID_INPUT" as const }));
}

function buildFailedSessionGoogleEventPayloadStep({
	args,
	client
}: {
	args: AdminSessionUpdateArgs;
	client: AdminSessionGoogleCalendarClient;
}) {
	return () => buildFailedSessionGoogleEventPayload({ args, client });
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
	}).andThen(mapFailedSessionPayloadResultStep);
}

function insertFailedSessionGoogleEvent({
	client,
	requestBody
}: {
	client: AdminSessionGoogleCalendarClient;
	requestBody: calendar_v3.Schema$Event;
}) {
	return tryPromise({
		try: () =>
			client.calendar.events.insert({
				calendarId: client.calendarId,
				sendUpdates: "all",
				requestBody
			}),
		catch: (error) => {
			const parsedError = calendarErrorSchema.safeParse(error);

			return {
				reason: parsedError.success
					? mapCalendarErrorCode(parsedError.data, "GOOGLE_CALENDAR_CREATE_FAILED")
					: "GOOGLE_CALENDAR_CREATE_FAILED"
			};
		}
	});
}

function loadSessionForAdminEditStep(ctx: ActionCtx, bookingId: Id<"bookings">) {
	return () => getSessionFromQuery(ctx, bookingId);
}

export function requireEditSessionsPermissionAndLoadBooking(
	ctx: ActionCtx,
	bookingId: Id<"bookings">
) {
	return requirePermissionActions(ctx, "edit:sessions").andThen(
		loadSessionForAdminEditStep(ctx, bookingId)
	);
}

function adminSessionEditDepsStep(settings: SessionAvailabilitySettings) {
	return (client: AdminSessionGoogleCalendarClient) => ({ client, settings });
}

function loadAdminEditGoogleClientStep(settings: SessionAvailabilitySettings) {
	return loadGoogleCalendarClient("GOOGLE_CALENDAR_AVAILABILITY_FAILED").map(
		adminSessionEditDepsStep(settings)
	);
}

export function loadAdminSessionEditDeps(ctx: ActionCtx) {
	return loadBookingAvailabilitySettings(ctx).andThen(loadAdminEditGoogleClientStep);
}

function rethrowSaveErrorAfterOrphanCleanupStep<Error extends AdminSessionUpdateError>(
	saveError: Error
) {
	return () => err(saveError);
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
			.andThen(rethrowSaveErrorAfterOrphanCleanupStep(saveError));
	});
}

function savePromotedFailedSessionStep(args: {
	args: AdminSessionUpdateArgs;
	session: Doc<"bookings">;
	client: AdminSessionGoogleCalendarClient;
	ctx: ActionCtx;
	reservation?: SessionReservation;
}) {
	return (createdEvent: { data: { id?: string | null } }) => {
		const googleEventId = createdEvent.data.id ?? undefined;

		return savePromotedFailedSession({ ...args, googleEventId });
	};
}

function insertFailedSessionGoogleEventStep(args: {
	args: AdminSessionUpdateArgs;
	session: Doc<"bookings">;
	client: AdminSessionGoogleCalendarClient;
	ctx: ActionCtx;
	reservation?: SessionReservation;
}) {
	return (requestBody: calendar_v3.Schema$Event) =>
		insertFailedSessionGoogleEvent({ client: args.client, requestBody }).andThen(
			savePromotedFailedSessionStep(args)
		);
}

function createdFromFailedGoogleOutcomeStep() {
	return { googleOutcome: "createdFromFailed" as const };
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
	const promoteArgs = { args, session, client, ctx, reservation };

	return verifyFailedSessionNewSlot({ args, session, client, settings })
		.andThen(buildFailedSessionGoogleEventPayloadStep({ args, client }))
		.andThen(insertFailedSessionGoogleEventStep(promoteArgs))
		.map(createdFromFailedGoogleOutcomeStep);
}

function emptyAdminSessionUpdateResultStep() {
	return {};
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

	return saveAdminSessionUpdate(ctx, saveArgs).map(emptyAdminSessionUpdateResultStep);
}

function shouldSyncConfirmedToGoogle(session: Doc<"bookings">, args: AdminSessionUpdateArgs) {
	const fieldChanges = getSessionEditFieldChanges(session, args);

	return fieldChanges.timingFieldsChanged || fieldChanges.googleEventFieldsChanged;
}

function confirmedGoogleSaveOutcomeStep(outcome?: "replacementCreated") {
	return () => ({ googleOutcome: outcome });
}

function saveConfirmedTimingUpdateStep(args: {
	args: AdminSessionUpdateArgs;
	ctx: ActionCtx;
	reservation?: SessionReservation;
}) {
	return (timingUpdate: {
		googleCalendarId?: string;
		googleEventId?: string;
		outcome?: "replacementCreated";
	}) => {
		if (!timingUpdate.googleEventId && !timingUpdate.googleCalendarId) {
			return ok(null);
		}

		const saveArgs: SaveAdminSessionUpdateArgs = {
			...args.args,
			googleCalendarId: timingUpdate.googleCalendarId,
			googleEventId: timingUpdate.googleEventId
		};

		if (args.reservation) {
			saveArgs.reservation = args.reservation;
		}

		return saveAdminSessionUpdate(args.ctx, saveArgs).map(
			confirmedGoogleSaveOutcomeStep(timingUpdate.outcome)
		);
	};
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
	}).andThen(saveConfirmedTimingUpdateStep({ args, ctx, reservation }));
}

function saveAdminFieldsOnlyStep(args: {
	args: AdminSessionUpdateArgs;
	ctx: ActionCtx;
	reservation?: SessionReservation;
}) {
	return () => saveAdminFieldsOnly(args);
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
		}).andThen(saveAdminFieldsOnlyStep({ args, ctx, reservation }));
	}

	if (!shouldSyncConfirmedToGoogle(session, args)) {
		return saveAdminFieldsOnly({ args, ctx, reservation });
	}

	return updateConfirmedGoogleEvent({ args, session, client, ctx, reservation, settings }).andThen(
		resolveConfirmedGoogleSyncOutcomeStep({ args, ctx, reservation })
	);
}

function resolveConfirmedGoogleSyncOutcomeStep(args: {
	args: AdminSessionUpdateArgs;
	ctx: ActionCtx;
	reservation?: SessionReservation;
}) {
	return (replacementOutcome: AdminSessionUpdateResult | null) => {
		if (replacementOutcome) {
			return ok(replacementOutcome);
		}

		return saveAdminFieldsOnly(args);
	};
}

function requireAvailableAdminReservationStep(reservationResult: {
	outcome: "reserved" | "unavailable";
	reservation?: SessionReservation;
}) {
	if (reservationResult.outcome === "unavailable") {
		return errAsync({ reason: "BOOKING_TIME_UNAVAILABLE" as const });
	}

	return okAsync(reservationResult.reservation!);
}

function reserveAdminSessionSlotStep(
	ctx: ActionCtx,
	args: AdminSessionUpdateArgs,
	session: Doc<"bookings">,
	settings: SessionAvailabilitySettings
) {
	return (sessionStartAt: number) =>
		reserveSessionSlot(ctx, {
			bookingId: session._id,
			duration: args.duration,
			eventBufferMinutes: settings.eventBufferMinutes,
			sessionStartAt
		}).andThen(requireAvailableAdminReservationStep);
}

function reserveSlotForAdminTimingChange(
	ctx: ActionCtx,
	args: AdminSessionUpdateArgs,
	session: Doc<"bookings">,
	client: AdminSessionGoogleCalendarClient,
	settings: SessionAvailabilitySettings
) {
	return getSessionStartAt(args.date, args.time, client.timeZone).asyncAndThen(
		reserveAdminSessionSlotStep(ctx, args, session, settings)
	);
}

function rethrowAdminUpdateErrorStep<Error extends AdminSessionUpdateError>(error: Error) {
	return () => err(error);
}

function compensateFailedAdminUpdateStep(
	ctx: ActionCtx,
	session: Doc<"bookings">,
	reservation: SessionReservation
) {
	return (error: AdminSessionUpdateError) =>
		clearSessionSlotReservation(ctx, { bookingId: session._id, reservation }).andThen(
			rethrowAdminUpdateErrorStep(error)
		);
}

function withReservationCompensation(
	ctx: ActionCtx,
	session: Doc<"bookings">,
	reservation: SessionReservation,
	update: () => ResultAsync<
		AdminSessionUpdateResult,
		| AdminSessionUpdateError
		| {
				reason:
					| "GOOGLE_CALENDAR_AUTH_FAILED"
					| "GOOGLE_CALENDAR_AVAILABILITY_FAILED"
					| "GOOGLE_CALENDAR_RATE_LIMITED";
		  }
	>
) {
	return update().orElse(compensateFailedAdminUpdateStep(ctx, session, reservation));
}

function syncAdminSessionWithReservationStep(args: {
	args: AdminSessionUpdateArgs;
	session: Doc<"bookings">;
	client: AdminSessionGoogleCalendarClient;
	ctx: ActionCtx;
	settings: SessionAvailabilitySettings;
}) {
	return (reservation: SessionReservation) =>
		withReservationCompensation(args.ctx, args.session, reservation, () =>
			syncAdminSessionGoogleAndSave({ ...args, reservation })
		);
}

export function attachAdminUpdateContext(
	session: Doc<"bookings">,
	settings: SessionAvailabilitySettings
) {
	return (result: AdminSessionUpdateResult) => ({ result, session, settings });
}

export function syncAdminBookingGoogleCalendarAndDb({
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
}) {
	if (!didSessionTimingChange(session, args)) {
		return syncAdminSessionGoogleAndSave({ args, session, client, ctx, settings });
	}

	return reserveSlotForAdminTimingChange(ctx, args, session, client, settings).andThen(
		syncAdminSessionWithReservationStep({ args, session, client, ctx, settings })
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
