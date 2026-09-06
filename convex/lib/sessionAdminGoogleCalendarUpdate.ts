import type { calendar_v3 } from "googleapis/build/src/apis/calendar/v3";
import { err, ok, ResultAsync } from "neverthrow";
import { internal } from "#convex/_generated/api";
import type { Doc } from "#convex/_generated/dataModel";
import type { ActionCtx } from "#convex/_generated/server";
import { getGoogleCalendarErrorCode } from "#convex/lib/googleCalendarErrors";
import { fromConvexTuple } from "#convex/lib/result";
import {
	buildSessionCalendarEventPayload,
	removeOrphanedSessionCalendarEvent,
	updateSessionCalendarEventTiming,
	type SessionCalendarEventDetails,
	type SessionCalendarTimingUpdateResult
} from "#convex/lib/sessionCalendarEvents";
import type { SessionAvailabilitySettings } from "#convex/lib/sessionCalendarTime";
import type { SessionReservation } from "#convex/lib/sessionReservations";
import {
	didSessionTimingChange,
	getSessionStartAt,
	type AdminSessionUpdateArgs,
	type AdminSessionUpdateError,
	type AdminSessionUpdateResult,
	validateSessionTimingEdit,
	verifySessionCanBeScheduled
} from "#convex/lib/sessionAdminEdit";

type GoogleCalendarLike = Pick<calendar_v3.Calendar, "events">;

export interface AdminSessionGoogleCalendarClient {
	calendar: GoogleCalendarLike;
	calendarId: string;
	calendarIds: string[];
	timeZone: string;
}

function getAdminSessionEventDetails(args: AdminSessionUpdateArgs) {
	return {
		addons: args.addons,
		duration: args.duration,
		email: args.email,
		name: args.name,
		service: args.service
	};
}

function promoteFailedSessionFromAdmin({
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
}): ResultAsync<AdminSessionUpdateResult, AdminSessionUpdateError> {
	// Failed bookings are only promoted when the edited time is valid and available.
	return ResultAsync.fromSafePromise(
		verifySessionCanBeScheduled({
			session: { ...session, date: args.date, duration: args.duration, time: args.time },
			calendar: client.calendar,
			calendarIds: client.calendarIds,
			settings,
			timeZone: client.timeZone
		})
	).andThen((canBeScheduled) => {
		if (!canBeScheduled) {
			return err({ reason: "BOOKING_TIME_UNAVAILABLE" as const });
		}

		// Create the Calendar event before saving so Google failures block the Convex update.
		return ResultAsync.fromPromise(
			Promise.resolve().then(() =>
				buildSessionCalendarEventPayload({
					date: args.date,
					details: getAdminSessionEventDetails(args),
					time: args.time,
					timeZone: client.timeZone
				})
			),
			(error) => ({ reason: getGoogleCalendarErrorCode(error, "GOOGLE_CALENDAR_CREATE_FAILED") })
		)
			.andThen((payloadResult) =>
				payloadResult.mapErr(() => ({ reason: "BOOKING_INVALID_INPUT" as const }))
			)
			.andThen((requestBody) =>
				ResultAsync.fromPromise(
					client.calendar.events.insert({
						calendarId: client.calendarId,
						sendUpdates: "all",
						requestBody
					}),
					(error) => ({
						reason: getGoogleCalendarErrorCode(error, "GOOGLE_CALENDAR_CREATE_FAILED")
					})
				)
			)
			.andThen((createdEvent) => {
				const googleEventId = createdEvent.data.id ?? undefined;

				// Promote to confirmed and clear the previous failure code in the save mutation.
				return fromConvexTuple(
					ctx.runMutation(internal.sessionScheduling.saveAdminSessionUpdate, {
						...args,
						confirmBooking: true,
						googleCalendarId: client.calendarId,
						googleEventId,
						...(reservation ? { reservation } : {})
					})
				).orElse((saveError) => {
					const shouldRemoveOrphanedEvent =
						saveError.reason === "BOOKING_TIME_UNAVAILABLE" ||
						saveError.reason === "BOOKING_NOT_FOUND";
					if (!shouldRemoveOrphanedEvent || googleEventId === undefined) {
						return err(saveError);
					}

					return ResultAsync.fromSafePromise(
						removeOrphanedSessionCalendarEvent({
							bookingId: session._id,
							calendar: client.calendar,
							calendarId: client.calendarId,
							googleEventId
						})
					).andThen(() => err(saveError));
				});
			})
			.map(() => ({ googleOutcome: "createdFromFailed" as const }));
	});
}

export function updateSessionTimingWithGoogleCalendar({
	bypassAvailabilitySettings = false,
	session,
	client,
	date,
	details,
	duration,
	createMissingEvent = false,
	settings,
	time
}: {
	bypassAvailabilitySettings?: boolean;
	session: Doc<"bookings">;
	client: AdminSessionGoogleCalendarClient;
	date: string;
	details: SessionCalendarEventDetails;
	duration: string;
	createMissingEvent?: boolean;
	settings: SessionAvailabilitySettings;
	time: string;
}): ResultAsync<
	SessionCalendarTimingUpdateResult & { sessionStartAt: number },
	AdminSessionUpdateError
> {
	return getSessionStartAt(date, time, client.timeZone).asyncAndThen((sessionStartAt) =>
		validateSessionTimingEdit({
			bypassAvailabilitySettings,
			calendar: client.calendar,
			calendarIds: client.calendarIds,
			existing: {
				date: session.date,
				duration: session.duration,
				googleCalendarId: session.googleCalendarId,
				googleEventId: session.googleEventId,
				time: session.time
			},
			next: { date, duration, time },
			settings,
			timeZone: client.timeZone
		})
			.andThen(() =>
				ResultAsync.fromSafePromise(
					updateSessionCalendarEventTiming({
						session,
						client,
						date,
						details,
						createMissingEvent,
						time
					})
				).andThen((calendarResult) => calendarResult)
			)
			.map((calendarUpdate) => ({ ...calendarUpdate, sessionStartAt }))
	);
}

function updateConfirmedSessionGoogleEventOrCreateReplacement({
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
}): ResultAsync<AdminSessionUpdateResult | null, AdminSessionUpdateError> {
	return updateSessionTimingWithGoogleCalendar({
		bypassAvailabilitySettings: true,
		session,
		client,
		date: args.date,
		details: getAdminSessionEventDetails(args),
		duration: args.duration,
		settings,
		time: args.time
	}).andThen((timingUpdate) => {
		if (!timingUpdate.googleEventId && !timingUpdate.googleCalendarId) {
			return ok(null);
		}

		return fromConvexTuple(
			ctx.runMutation(internal.sessionScheduling.saveAdminSessionUpdate, {
				...args,
				googleCalendarId: timingUpdate.googleCalendarId,
				googleEventId: timingUpdate.googleEventId,
				...(reservation ? { reservation } : {})
			})
		).map(() => ({ googleOutcome: timingUpdate.outcome }));
	});
}

export function updateSessionFromAdminWithGoogleCalendar({
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
}): ResultAsync<AdminSessionUpdateResult, AdminSessionUpdateError> {
	// Updates that do not move the session do not need a slot reservation.
	if (!didSessionTimingChange(session, args)) {
		return applyAdminSessionUpdate({ args, session, client, ctx, settings });
	}

	// Convert the requested date and time, then reserve it before updating Convex or Google Calendar.
	return getSessionStartAt(args.date, args.time, client.timeZone).asyncAndThen((sessionStartAt) =>
		fromConvexTuple(
			ctx.runMutation(internal.sessionScheduling.reserveSessionReservation, {
				bookingId: session._id,
				duration: args.duration,
				eventBufferMinutes: settings.eventBufferMinutes,
				now: Date.now(),
				sessionStartAt
			})
		)
			.mapErr(() => ({ reason: "BOOKING_TIME_UNAVAILABLE" as const }))
			.andThen((reservationResult) => {
				if (reservationResult.outcome === "unavailable") {
					return err({ reason: "BOOKING_TIME_UNAVAILABLE" as const });
				}

				// Pass the reservation through so the save can prove it owns the time.
				const reservation = reservationResult.reservation;
				return applyAdminSessionUpdate({
					args,
					session,
					client,
					ctx,
					reservation,
					settings
				}).orElse((error) =>
					// Release the reservation if any part of the update fails.
					ResultAsync.fromSafePromise(
						ctx.runMutation(internal.sessionScheduling.clearSessionReservation, {
							bookingId: session._id,
							reservation
						})
					).andThen(() => err(error))
				);
			})
	);
}

function applyAdminSessionUpdate({
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
}): ResultAsync<AdminSessionUpdateResult, AdminSessionUpdateError> {
	// Failed checkouts have no Calendar event, so an admin edit creates one and confirms the session.
	if (session.status === "failed") {
		return promoteFailedSessionFromAdmin({ args, session, client, ctx, reservation, settings });
	}

	// Pending, expired, and abandoned bookings save in Convex only; no Google event sync.
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
		})
			.andThen(() =>
				fromConvexTuple(
					ctx.runMutation(internal.sessionScheduling.saveAdminSessionUpdate, {
						...args,
						...(reservation ? { reservation } : {})
					})
				)
			)
			.map(() => ({}));
	}

	// Update the linked Google event. If it is missing/cancelled, this creates and saves a replacement.
	return updateConfirmedSessionGoogleEventOrCreateReplacement({
		args,
		session,
		client,
		ctx,
		reservation,
		settings
	}).andThen((replacementOutcome) => {
		if (replacementOutcome) {
			return ok(replacementOutcome);
		}

		return fromConvexTuple(
			ctx.runMutation(internal.sessionScheduling.saveAdminSessionUpdate, {
				...args,
				...(reservation ? { reservation } : {})
			})
		).map(() => ({}));
	});
}
