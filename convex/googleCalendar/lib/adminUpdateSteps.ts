"use node";

import type { calendar_v3 } from "googleapis/build/src/apis/calendar/v3";
import { err, errAsync, ok, okAsync, type ResultAsync } from "neverthrow";
import type { Doc } from "#convex/_generated/dataModel";
import type { ActionCtx } from "#convex/_generated/server";

import { loadGoogleCalendarClient } from "#convex/googleCalendar/lib/googleCalendarClient";

import { saveAdminSessionUpdate } from "#convex/sessions/lib/calendarActionBoundaries";
import { type AdminSessionGoogleCalendarClient } from "#convex/googleCalendar/lib/calendarTimingSync";
import {
	calendarErrorSchema,
	mapCalendarErrorCode
} from "#convex/googleCalendar/lib/googleCalendarErrors";
import { tryPromise } from "#convex/shared/lib/result";
import { logError } from "#convex/shared/lib/logger";
import type { SaveAdminSessionUpdateArgs } from "#convex/sessions/lib/schedulingArgs";
import { pickBookingAddonQuantities } from "#/domain/booking/addon-quantities";
import { removeOrphanedSessionCalendarEvent } from "#convex/googleCalendar/lib/googleCalendarEventCalls";
import { buildSessionCalendarEventPayload } from "#convex/sessions/lib/calendarEventPayload";
import type { SessionAvailabilitySettings } from "#convex/sessions/lib/calendarTime";
import type { SessionReservation } from "#convex/sessions/lib/reservations";
import {
	didSessionTimingChange,
	getSessionEditFieldChanges,
	type AdminSessionUpdateArgs,
	type AdminSessionUpdateError,
	type AdminSessionUpdateResult as LibAdminSessionUpdateResult
} from "#convex/sessions/lib/adminEdit";

export type AdminSessionUpdateResult = LibAdminSessionUpdateResult;

export function eventDetails(args: AdminSessionUpdateArgs) {
	return {
		addons: args.addons,
		duration: args.duration,
		email: args.email,
		name: args.name,
		service: args.service,
		...pickBookingAddonQuantities(args)
	};
}

export function requireSchedulableFailedSession(canBeScheduled: boolean) {
	return canBeScheduled ? ok(undefined) : err({ reason: "BOOKING_TIME_UNAVAILABLE" as const });
}

export function mapFailedSessionPayloadResult(
	payloadResult: ReturnType<typeof buildSessionCalendarEventPayload>
) {
	return payloadResult.mapErr(() => ({ reason: "BOOKING_INVALID_INPUT" as const }));
}

export function insertFailedSessionGoogleEvent({
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

			const failure = {
				reason: parsedError.success
					? mapCalendarErrorCode(parsedError.data, "GOOGLE_CALENDAR_CREATE_FAILED")
					: "GOOGLE_CALENDAR_CREATE_FAILED"
			};

			logError(
				{
					operation: "googleCalendar.adminFailedSessionEvent.insert",
					...failure,
					calendarId: client.calendarId
				},
				error
			);

			return failure;
		}
	});
}

export function loadAdminEditGoogleClient(settings: SessionAvailabilitySettings) {
	return loadGoogleCalendarClient("GOOGLE_CALENDAR_AVAILABILITY_FAILED").map(
		(client: AdminSessionGoogleCalendarClient) => ({ client, settings })
	);
}

export function saveAdminFieldsOnly({
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

export function shouldSyncConfirmedToGoogle(
	session: Doc<"bookings">,
	args: AdminSessionUpdateArgs
) {
	const fieldChanges = getSessionEditFieldChanges(session, args);

	return fieldChanges.timingFieldsChanged || fieldChanges.googleEventFieldsChanged;
}

export function saveConfirmedTimingUpdate(
	args: { args: AdminSessionUpdateArgs; ctx: ActionCtx; reservation?: SessionReservation },
	timingUpdate: {
		googleCalendarId?: string;
		googleEventId?: string;
		outcome?: "replacementCreated";
	}
) {
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

	return saveAdminSessionUpdate(args.ctx, saveArgs).map(() => ({
		googleOutcome: timingUpdate.outcome
	}));
}

export function resolveConfirmedGoogleSyncOutcome(
	args: { args: AdminSessionUpdateArgs; ctx: ActionCtx; reservation?: SessionReservation },
	replacementOutcome: AdminSessionUpdateResult | null
) {
	if (replacementOutcome) {
		return ok(replacementOutcome);
	}

	return saveAdminFieldsOnly(args);
}

export function requireAvailableAdminReservation(reservationResult: {
	outcome: "reserved" | "unavailable";
	reservation?: SessionReservation;
}) {
	if (reservationResult.outcome === "unavailable") {
		return errAsync({ reason: "BOOKING_TIME_UNAVAILABLE" as const });
	}

	return okAsync(reservationResult.reservation!);
}

export type AdminUpdateContext = {
	args: AdminSessionUpdateArgs;
	session: Doc<"bookings">;
	client: AdminSessionGoogleCalendarClient;
	ctx: ActionCtx;
	reservation?: SessionReservation;
	settings: SessionAvailabilitySettings;
};

export type PromotedAdminUpdateContext = AdminUpdateContext & { googleEventId: string | undefined };

export function selectFailedAdminSessions(context: AdminUpdateContext) {
	return context.session.status === "failed" ? [context] : [];
}

export function selectNonFailedAdminSessions(context: AdminUpdateContext) {
	return context.session.status === "failed" ? [] : [context];
}

export function selectDraftAdminSessions(context: AdminUpdateContext) {
	return context.session.status !== "confirmed" && context.session.status !== "email_failed"
		? [context]
		: [];
}

export function selectConfirmedAdminSessions(context: AdminUpdateContext) {
	return context.session.status === "confirmed" || context.session.status === "email_failed"
		? [context]
		: [];
}

export function selectConfirmedSessionsNeedingGoogleSync(context: AdminUpdateContext) {
	return shouldSyncConfirmedToGoogle(context.session, context.args) ? [context] : [];
}

export function selectConfirmedSessionsNeedingFieldsOnly(context: AdminUpdateContext) {
	return shouldSyncConfirmedToGoogle(context.session, context.args) ? [] : [context];
}

export function selectAdminSessionsWithTimingChanges(context: AdminUpdateContext) {
	return didSessionTimingChange(context.session, context.args) ? [context] : [];
}

export function selectAdminSessionsWithoutTimingChanges(context: AdminUpdateContext) {
	return didSessionTimingChange(context.session, context.args) ? [] : [context];
}

export function selectAdminSessionsNeedingHostNotification(
	args: AdminSessionUpdateArgs,
	session: Doc<"bookings">,
	settings: SessionAvailabilitySettings,
	result: AdminSessionUpdateResult
) {
	return shouldNotifyAdminHost(args, session, result) ? [{ args, session, settings, result }] : [];
}

export function failedSessionAvailabilityArgs({
	args,
	session,
	client,
	settings
}: AdminUpdateContext) {
	return {
		session: { ...session, date: args.date, duration: args.duration, time: args.time },
		calendar: client.calendar,
		calendarIds: client.calendarIds,
		settings,
		timeZone: client.timeZone
	};
}

export function requestFailedSessionEventPayload({ args, client }: AdminUpdateContext) {
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
	});
}

export function promotedSessionSaveArgs({
	args,
	client,
	googleEventId,
	reservation
}: PromotedAdminUpdateContext): SaveAdminSessionUpdateArgs {
	const saveArgs: SaveAdminSessionUpdateArgs = {
		...args,
		confirmBooking: true,
		googleCalendarId: client.calendarId,
		googleEventId
	};

	if (reservation) saveArgs.reservation = reservation;

	return saveArgs;
}

export function cleanupPromotedEventAfterSaveFailure(
	context: PromotedAdminUpdateContext,
	error: AdminSessionUpdateError
): ResultAsync<undefined, never> {
	if (
		(error.reason !== "BOOKING_TIME_UNAVAILABLE" && error.reason !== "BOOKING_NOT_FOUND") ||
		context.googleEventId === undefined
	)
		return okAsync(undefined);

	return removeOrphanedSessionCalendarEvent({
		bookingId: context.session._id,
		calendar: context.client.calendar,
		calendarId: context.client.calendarId,
		googleEventId: context.googleEventId
	}).orElse(() => okAsync(undefined));
}

export function shouldNotifyAdminHost(
	args: AdminSessionUpdateArgs,
	session: Doc<"bookings">,
	result: AdminSessionUpdateResult
) {
	return (
		didSessionTimingChange(session, args) &&
		(session.status === "confirmed" || session.status === "email_failed") &&
		result.googleOutcome !== "createdFromFailed"
	);
}
