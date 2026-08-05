"use node";

import { err, ok, okAsync, ResultAsync, type Result } from "neverthrow";
import { api, internal } from "#convex/_generated/api";
import type { Doc, Id } from "#convex/_generated/dataModel";
import type { ActionCtx } from "#convex/_generated/server";
import { getAdminIdentity } from "#convex/lib/auth";
import {
	saveConfirmedBooking,
	sendBookingReminderEmailForSession,
	sendConfirmedBookingInvoice
} from "#convex/lib/bookingConfirmation";
import { getSelectedBookingCustomInvoice } from "#convex/lib/customInvoices";
import { sendBookingInvoiceEmailsForBooking } from "#convex/lib/email";
import { getGoogleCalendarClient } from "#convex/lib/googleCalendarClient";
import { buildSessionCalendarEventPayload } from "#convex/lib/sessionCalendarEvents";
import type { SessionAvailabilitySettings } from "#convex/lib/sessionCalendarTime";
import { failBookingConfirmation, verifySessionCanBeScheduled } from "#convex/lib/sessionAdminEdit";
import { getSessionFromQuery } from "#convex/lib/sessionLookup";
import { fromConvexTuple, okOrThrow } from "#convex/lib/result";
import { createRescheduleUrlForSession } from "#convex/lib/sessionRescheduleLinks";
import type { CompleteClaimedSessionSuccess } from "#convex/services/bookingConfirmation";

export type SendBookingInvoiceForBookingArgs = {
	bookingId: Id<"bookings">;
	customInvoiceId?: Id<"customInvoices">;
};

type SendBookingInvoiceError =
	| { reason: "NOT_AUTHENTICATED" }
	| { reason: "NOT_AUTHORIZED" }
	| { reason: "BOOKING_NOT_FOUND" }
	| { reason: "CUSTOM_INVOICE_NOT_FOUND" }
	| { reason: "INVOICE_SEND_FAILED" };

type CompleteClaimedSessionError =
	| { reason: "BOOKING_NOT_FOUND" }
	| { reason: "BOOKING_CONFIRMATION_NOT_CLAIMED" }
	| { reason: "BOOKING_RESERVATION_MISMATCH" };

export function sendBookingInvoiceForBookingService(
	ctx: ActionCtx,
	args: SendBookingInvoiceForBookingArgs
): ResultAsync<null, SendBookingInvoiceError> {
	return (
		getAdminIdentity(ctx)
			// Load the booking only after admin authorization succeeds.
			.andThen(() => getSessionFromQuery(ctx, args.bookingId))
			// Resolve and validate the optional stored custom invoice.
			.andThen((session) =>
				getSelectedBookingCustomInvoice(ctx, session._id, args.customInvoiceId).andThen(
					(customInvoice) =>
						args.customInvoiceId && !customInvoice
							? err({ reason: "CUSTOM_INVOICE_NOT_FOUND" as const })
							: ok({ customInvoice, session })
				)
			)
			// Create the single-use reschedule link included in the invoice email.
			.andThen(({ customInvoice, session }) =>
				createRescheduleUrlForSession(ctx, session)
					.mapErr(() => ({ reason: "INVOICE_SEND_FAILED" as const }))
					.map((rescheduleUrl) => ({ customInvoice, rescheduleUrl, session }))
			)
			// Load current lead-time guidance before rendering the invoice.
			.andThen((state) =>
				okOrThrow(ctx.runQuery(api.bookingSettings.get, {})).map((settings) => ({
					...state,
					settings
				}))
			)
			// Send the selected invoice artifact to the customer and host.
			.andThen(({ customInvoice, rescheduleUrl, session, settings }) =>
				ResultAsync.fromSafePromise(
					sendBookingInvoiceEmailsForBooking(session, {
						customInvoice: customInvoice ?? undefined,
						leadTimeMinutes: settings.leadTimeMinutes,
						rescheduleUrl
					})
				)
					.andThen((emailResult) => emailResult)
					.mapErr(() => ({ reason: "INVOICE_SEND_FAILED" as const }))
					.map(() => session)
			)
			// Record recovery from a previous invoice-email failure.
			.andThen((session) =>
				fromConvexTuple(
					ctx.runMutation(internal.bookingConfirmation.markSessionInvoiceEmailRetrySent, {
						bookingId: session._id
					})
				).map(() => null)
			)
	);
}

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

export async function completeClaimedSessionService(
	ctx: ActionCtx,
	args: { bookingId: Id<"bookings"> }
): Promise<Result<CompleteClaimedSessionSuccess, CompleteClaimedSessionError>> {
	return await getSessionFromQuery(ctx, args.bookingId)
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

			return (
				okOrThrow(ctx.runQuery(api.bookingSettings.get, {}))
					// Run the provider and persistence workflow with current booking settings.
					.andThen((settings) =>
						ResultAsync.fromSafePromise(completeClaimedSession(ctx, session, settings)).andThen(
							(result) => result
						)
					)
			);
		});
}

async function completeClaimedSession(
	ctx: ActionCtx,
	session: Doc<"bookings">,
	settings: SessionAvailabilitySettings
) {
	const calendarClient = getGoogleCalendarClient();
	const canBeScheduled = await verifySessionCanBeScheduled({
		session,
		calendar: calendarClient.calendar,
		calendarIds: calendarClient.calendarIds,
		settings,
		timeZone: calendarClient.timeZone
	});

	if (!canBeScheduled) {
		return await failBookingConfirmation(ctx, session._id, "BOOKING_TIME_UNAVAILABLE").map(() => ({
			outcome: "booking_time_unavailable" as const
		}));
	}

	// Atomically reserve the window so concurrent payment completions cannot both create events.
	const reservationResult = await fromConvexTuple(
		ctx.runMutation(internal.sessionScheduling.reserveSessionReservation, {
			bookingId: session._id,
			duration: session.duration,
			eventBufferMinutes: settings.eventBufferMinutes,
			now: Date.now(),
			sessionStartAt: session.sessionStartAt
		})
	)
		.orElse(() => okAsync({ outcome: "unavailable" as const }))
		.match(
			(result) => result,
			(error: never) => error
		);

	if (reservationResult.outcome === "unavailable") {
		return await failBookingConfirmation(ctx, session._id, "BOOKING_TIME_UNAVAILABLE").map(() => ({
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
			service: session.service
		}
	});

	if (payloadResult.isErr()) {
		return await failBookingConfirmation(
			ctx,
			session._id,
			"BOOKING_INVALID_INPUT",
			reservation
		).map(() => ({ outcome: "booking_invalid_input" as const }));
	}

	let googleEventId: string | undefined;
	try {
		const createdEvent = await calendarClient.calendar.events.insert({
			calendarId: calendarClient.calendarId,
			sendUpdates: "all",
			requestBody: payloadResult.value
		});
		googleEventId = createdEvent.data.id ?? undefined;
	} catch {
		return await failBookingConfirmation(
			ctx,
			session._id,
			"GOOGLE_CALENDAR_CREATE_FAILED",
			reservation
		).map(() => ({ outcome: "google_calendar_create_failed" as const }));
	}

	const completionSaved = await saveConfirmedBooking(
		ctx,
		session,
		calendarClient,
		reservation,
		googleEventId
	);

	if (!completionSaved) {
		return ok({ outcome: "reservation_lost" as const });
	}

	await sendConfirmedBookingInvoice(ctx, session, settings);
	return ok({ outcome: "completed" as const });
}
