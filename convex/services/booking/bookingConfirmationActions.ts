"use node";

import { err, ok, okAsync, ResultAsync, type Result } from "neverthrow";
import { api, internal } from "#convex/_generated/api";
import type { Doc, Id } from "#convex/_generated/dataModel";
import type { ActionCtx } from "#convex/_generated/server";
import {
	saveConfirmedBooking,
	sendBookingReminderEmailForSession,
	sendConfirmedBookingInvoice
} from "#convex/lib/booking/bookingConfirmation";
import { getGoogleCalendarClient } from "#convex/lib/googleCalendar/googleCalendarClient";
import { calendarResultAsync } from "#convex/lib/googleCalendar/googleCalendarErrors";
import { buildSessionCalendarEventPayload } from "#convex/lib/sessions/sessionCalendarEvents";
import { pickBookingAddonQuantities } from "#studio/features/booking-form/lib/booking-form-model";
import type { SessionAvailabilitySettings } from "#convex/lib/sessions/sessionCalendarTime";
import {
	failBookingConfirmation,
	verifySessionCanBeScheduled
} from "#convex/lib/sessions/sessionAdminEdit";
import { getSessionFromQuery } from "#convex/lib/sessions/sessionLookup";
import { fromConvexTuple, okOrThrow } from "#convex/lib/result";
import type { CompleteClaimedSessionSuccess } from "#convex/services/booking/bookingConfirmation";

type CompleteClaimedSessionError =
	| { reason: "BOOKING_NOT_FOUND" }
	| { reason: "BOOKING_CONFIRMATION_NOT_CLAIMED" }
	| { reason: "BOOKING_RESERVATION_MISMATCH" }
	| { reason: "GOOGLE_CALENDAR_AUTH_FAILED" }
	| { reason: "GOOGLE_CALENDAR_AVAILABILITY_FAILED" }
	| { reason: "GOOGLE_CALENDAR_RATE_LIMITED" };

export async function sendSessionReminderEmailService(
	ctx: ActionCtx,
	args: { bookingId: Id<"bookings"> }
): Promise<Result<null, never>> {
	const now = Date.now();

	return await fromConvexTuple(
		ctx.runMutation(internal.sessionReminders.claimReminder, { bookingId: args.bookingId, now })
	)
		.map((claim) => ({ kind: "claimed" as const, claim }))
		.orElse(() => okAsync({ kind: "skipped" as const }))
		// A failed or duplicate claim means this worker has nothing to deliver.
		.andThen((claimState) => {
			if (claimState.kind === "skipped") return okAsync(null);

			return (
				sendBookingReminderEmailForSession(ctx, claimState.claim.session)
					// Record successful delivery and clear the reminder claim.
					.andThen(() =>
						fromConvexTuple(
							ctx.runMutation(internal.sessionReminders.markReminderSent, {
								bookingId: args.bookingId,
								now: Date.now()
							})
						).map(() => null)
					)
					// Delivery failures are persisted for retry rather than returned to the scheduler.
					.orElse((reminderError) =>
						fromConvexTuple(
							ctx.runMutation(internal.sessionReminders.markReminderFailed, {
								bookingId: args.bookingId,
								failureCode: reminderError.reason
							})
						)
							.map(() => null)
							.orElse(() => okAsync(null))
					)
			);
		})
		.orElse(() => okAsync(null));
}

export function completeClaimedSessionService(
	ctx: ActionCtx,
	args: { bookingId: Id<"bookings"> }
): ResultAsync<CompleteClaimedSessionSuccess, CompleteClaimedSessionError> {
	return (
		getSessionFromQuery(ctx, args.bookingId)
			.andThen((session) =>
				session.bookingConfirmationClaimedAt
					? ok(session)
					: err({ reason: "BOOKING_CONFIRMATION_NOT_CLAIMED" as const })
			)
			// Skip provider work when another attempt already completed the booking.
			.andThen((session) => {
				if (session.status === "confirmed" || session.status === "email_failed") {
					return okAsync({ outcome: "already_completed" as const });
				}

				return okOrThrow(ctx.runQuery(api.bookingSettings.get, {})).andThen((settings) =>
					completeClaimedSession(ctx, session, settings)
				);
			})
	);
}

function completeClaimedSession(
	ctx: ActionCtx,
	session: Doc<"bookings">,
	settings: SessionAvailabilitySettings
): ResultAsync<CompleteClaimedSessionSuccess, CompleteClaimedSessionError> {
	const calendarClient = getGoogleCalendarClient();

	return verifySessionCanBeScheduled({
		session,
		calendar: calendarClient.calendar,
		calendarIds: calendarClient.calendarIds,
		settings,
		timeZone: calendarClient.timeZone
	}).andThen((canBeScheduled) => {
		if (!canBeScheduled) {
			return failBookingConfirmation(ctx, session._id, "BOOKING_TIME_UNAVAILABLE").map(() => ({
				outcome: "booking_time_unavailable" as const
			}));
		}

		return fromConvexTuple(
			ctx.runMutation(internal.sessionScheduling.reserveSessionReservation, {
				bookingId: session._id,
				duration: session.duration,
				eventBufferMinutes: settings.eventBufferMinutes,
				now: Date.now(),
				sessionStartAt: session.sessionStartAt
			})
		)
			.orElse(() => okAsync({ outcome: "unavailable" as const }))
			.andThen((reservationResult) => {
				if (reservationResult.outcome === "unavailable") {
					return failBookingConfirmation(ctx, session._id, "BOOKING_TIME_UNAVAILABLE").map(() => ({
						outcome: "booking_time_unavailable" as const
					}));
				}

				const reservation = reservationResult.reservation;

				const payloadResult = buildSessionCalendarEventPayload({
					date: session.date,
					time: session.time,
					timeZone: calendarClient.timeZone,
					details: {
						addons: session.addons,
						name: session.name,
						duration: session.duration,
						email: session.email,
						service: session.service,
						...pickBookingAddonQuantities(session)
					}
				});

				if (payloadResult.isErr()) {
					return failBookingConfirmation(
						ctx,
						session._id,
						"BOOKING_INVALID_INPUT",
						reservation
					).map(() => ({ outcome: "booking_invalid_input" as const }));
				}

				return calendarResultAsync(
					calendarClient.calendar.events.insert({
						calendarId: calendarClient.calendarId,
						sendUpdates: "all",
						requestBody: payloadResult.value
					}),
					"GOOGLE_CALENDAR_CREATE_FAILED"
				)
					.andThen((createdEvent) => {
						const googleEventId = createdEvent.data.id ?? undefined;

						return saveConfirmedBooking(
							ctx,
							session,
							calendarClient,
							reservation,
							googleEventId
						).andThen((completionSaved) => {
							if (!completionSaved) {
								return okAsync({ outcome: "reservation_lost" as const });
							}

							return sendConfirmedBookingInvoice(ctx, session, settings).map(() => ({
								outcome: "completed" as const
							}));
						});
					})
					.orElse(() =>
						failBookingConfirmation(
							ctx,
							session._id,
							"GOOGLE_CALENDAR_CREATE_FAILED",
							reservation
						).map(() => ({ outcome: "google_calendar_create_failed" as const }))
					);
			});
	});
}
