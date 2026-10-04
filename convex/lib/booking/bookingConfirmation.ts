"use node";

import { okAsync, type ResultAsync } from "neverthrow";
import { createRescheduleUrlForSession } from "#convex/lib/sessions/sessionRescheduleLinks";
import { internal } from "#convex/_generated/api";
import type { Doc, Id } from "#convex/_generated/dataModel";
import type { ActionCtx } from "#convex/_generated/server";
import { sendBookingReceiptEmailsForBooking } from "#convex/lib/booking/bookingDocumentEmails";
import { sendSessionReminderEmail } from "#convex/lib/email/email";
import { pickBookingAddonQuantities } from "#studio/features/booking-form/lib/booking-form-model";
import { getGoogleCalendarClient } from "#convex/lib/googleCalendar/googleCalendarClient";
import { removeOrphanedSessionCalendarEvent } from "#convex/lib/sessions/sessionCalendarEvents";
import {
	buildEventWindow,
	type SessionAvailabilitySettings
} from "#convex/lib/sessions/sessionCalendarTime";
import type { SessionReservation } from "#convex/lib/sessions/sessionReservations";
import { fromConvexTuple, okOrThrow } from "#convex/lib/result";
import { exhaustiveCheck } from "#/lib/result";

function getReminderRescheduleUrl(ctx: ActionCtx, session: Doc<"bookings">) {
	if (session.packageId !== undefined) {
		return okAsync<string | undefined>(undefined);
	}

	return createRescheduleUrlForSession(ctx, session).map(
		(rescheduleUrl): string | undefined => rescheduleUrl
	);
}

export function sendBookingReminderEmailForSession(ctx: ActionCtx, session: Doc<"bookings">) {
	const { timeZone } = getGoogleCalendarClient();

	return buildEventWindow(session.date, session.time, session.duration, timeZone).asyncAndThen(
		({ startDateTime }) =>
			getReminderRescheduleUrl(ctx, session).andThen((rescheduleUrl) =>
				sendSessionReminderEmail({
					name: session.name,
					email: session.email,
					date: session.date,
					startDateTime,
					time: session.time,
					timeZone,
					service: session.service,
					duration: session.duration,
					addons: session.addons,
					rescheduleUrl,
					isPackageSession: session.packageId !== undefined,
					...pickBookingAddonQuantities(session)
				})
			)
	);
}

export function saveConfirmedBooking(
	ctx: ActionCtx,
	session: Doc<"bookings">,
	calendarClient: ReturnType<typeof getGoogleCalendarClient>,
	reservation: SessionReservation,
	googleEventId: string | undefined
): ResultAsync<boolean, never> {
	return fromConvexTuple(
		ctx.runMutation(internal.bookingConfirmation.markBookingConfirmed, {
			bookingId: session._id,
			googleEventId,
			googleCalendarId: calendarClient.calendarId,
			reservation
		})
	)
		.map(() => true)
		.orElse((error) => {
			const reason = error.reason;

			switch (reason) {
				case "BOOKING_NOT_FOUND":
					console.error("Booking disappeared before confirmation completed", {
						bookingId: session._id
					});
					break;
				case "BOOKING_RESERVATION_MISMATCH":
					console.error("Booking reservation changed before confirmation completed", {
						bookingId: session._id
					});
					break;
				case "BOOKING_INVALID_DURATION":
					console.error("Booking duration was invalid before Drive setup could be scheduled", {
						bookingId: session._id
					});
					break;
				default:
					exhaustiveCheck(reason);
			}

			if (!googleEventId) {
				return okAsync(false);
			}

			return okOrThrow(
				removeOrphanedSessionCalendarEvent({
					bookingId: session._id,
					calendar: calendarClient.calendar,
					calendarId: calendarClient.calendarId,
					googleEventId
				})
			).map(() => false);
		});
}

function recordInvoiceEmailFailure(
	ctx: ActionCtx,
	{ bookingId, message, reason }: { bookingId: Id<"bookings">; message: string; reason: string }
): ResultAsync<null, never> {
	console.error(message, { bookingId, reason });

	return fromConvexTuple(
		ctx.runMutation(internal.bookingConfirmation.markSessionInvoiceEmailFailed, { bookingId })
	)
		.map(() => null)
		.orElse((markFailedError) => {
			console.error("Failed to record booking invoice email failure", {
				bookingId,
				reason: markFailedError.reason
			});

			return okAsync(null);
		});
}

export function sendConfirmedBookingInvoice(
	ctx: ActionCtx,
	session: Doc<"bookings">,
	settings: SessionAvailabilitySettings
): ResultAsync<null, never> {
	return createRescheduleUrlForSession(ctx, session)
		.andThen((rescheduleUrl) =>
			sendBookingReceiptEmailsForBooking(session, {
				leadTimeMinutes: settings.leadTimeMinutes,
				rescheduleUrl
			})
				.andThen((emailResult) =>
					fromConvexTuple(
						ctx.runMutation(internal.bookingConfirmation.recordBookingReceiptNumber, {
							bookingId: session._id,
							receiptNumber: emailResult.receiptNumber
						})
					)
						.map(() => null)
						.orElse((recordReceiptError) => {
							console.error("Failed to store booking receipt number after email send", {
								bookingId: session._id,
								reason: recordReceiptError.reason
							});

							return okAsync(null);
						})
				)
				.orElse((error) =>
					recordInvoiceEmailFailure(ctx, {
						bookingId: session._id,
						message: "Booking invoice email failed during booking confirmation",
						reason: error.reason
					})
				)
		)
		.orElse((error) =>
			recordInvoiceEmailFailure(ctx, {
				bookingId: session._id,
				message: "Booking invoice reschedule link create failed",
				reason: error.reason
			})
		);
}
