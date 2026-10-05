"use node";

import { okAsync, type ResultAsync } from "neverthrow";
import { createRescheduleUrlForSession } from "#convex/lib/sessions/sessionRescheduleLinks";
import { internal } from "#convex/_generated/api";
import type { Doc, Id } from "#convex/_generated/dataModel";
import type { ActionCtx } from "#convex/_generated/server";
import { pickBookingAddonQuantities } from "#studio/features/booking-form/lib/booking-form-model";
import { getGoogleCalendarClient } from "#convex/lib/googleCalendar/googleCalendarClient";
import { removeOrphanedSessionCalendarEvent } from "#convex/lib/googleCalendar/googleCalendarEventCalls";
import {
	buildEventWindow,
	type SessionAvailabilitySettings
} from "#convex/lib/sessions/sessionCalendarTime";
import type { SessionReservation } from "#convex/lib/sessions/sessionReservations";
import { fromConvexTuple } from "#convex/lib/result";
import { exhaustiveCheck } from "#/lib/result";
import { sendBookingReceiptEmailsForBooking } from "#convex/services/booking/bookingReceiptEmails";
import { sendSessionReminderEmail } from "#convex/services/email/bookingCustomerEmails";

function sendReminderEmailForSessionWindow(
	session: Doc<"bookings">,
	timeZone: string,
	startDateTime: string,

	rescheduleUrl: string | undefined
) {
	return sendSessionReminderEmail({
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
	});
}

function sendReminderAfterEventWindow(
	ctx: ActionCtx,
	session: Doc<"bookings">,
	timeZone: string,
	startDateTime: string
) {
	if (session.packageId !== undefined) {
		return sendReminderEmailForSessionWindow(session, timeZone, startDateTime, undefined);
	}

	return createRescheduleUrlForSession(ctx, session).andThen((rescheduleUrl: string | undefined) =>
		sendReminderEmailForSessionWindow(session, timeZone, startDateTime, rescheduleUrl)
	);
}

function sendReminderAfterRescheduleUrl(
	ctx: ActionCtx,
	session: Doc<"bookings">,
	timeZone: string,

	{ startDateTime }: { startDateTime: string }
) {
	return sendReminderAfterEventWindow(ctx, session, timeZone, startDateTime);
}

export function sendBookingReminderEmailForSession(ctx: ActionCtx, session: Doc<"bookings">) {
	const { timeZone } = getGoogleCalendarClient();

	return buildEventWindow(session.date, session.time, session.duration, timeZone).asyncAndThen(
		(_value) => sendReminderAfterRescheduleUrl(ctx, session, timeZone, _value)
	);
}

function confirmedBookingSaved() {
	return true;
}

function handleSaveConfirmedBookingFailure(
	_ctx: ActionCtx,
	session: Doc<"bookings">,
	googleEventId: string | undefined,
	calendarClient: ReturnType<typeof getGoogleCalendarClient>,

	error:
		| { reason: "BOOKING_NOT_FOUND" }
		| { reason: "BOOKING_RESERVATION_MISMATCH" }
		| { reason: "BOOKING_INVALID_DURATION" }
) {
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

	return removeOrphanedSessionCalendarEvent({
		bookingId: session._id,
		calendar: calendarClient.calendar,
		calendarId: calendarClient.calendarId,
		googleEventId
	})
		.map(orphanedCalendarEventRemoved)
		.orElse(saveConfirmedBookingOrphanCleanupFailed);
}

function orphanedCalendarEventRemoved() {
	return false;
}

function saveConfirmedBookingOrphanCleanupFailed() {
	return okAsync(false);
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
		.map(confirmedBookingSaved)
		.orElse(
			(
				error:
					| { reason: "BOOKING_NOT_FOUND" }
					| { reason: "BOOKING_RESERVATION_MISMATCH" }
					| { reason: "BOOKING_INVALID_DURATION" }
			) => handleSaveConfirmedBookingFailure(ctx, session, googleEventId, calendarClient, error)
		);
}

function invoiceEmailFailureRecorded() {
	return null;
}

function logInvoiceEmailFailureMarkFailed(
	bookingId: Id<"bookings">,
	markFailedError: { reason: string }
) {
	console.error("Failed to record booking invoice email failure", {
		bookingId,
		reason: markFailedError.reason
	});

	return okAsync(null);
}

function recordInvoiceEmailFailure(
	ctx: ActionCtx,
	{ bookingId, message, reason }: { bookingId: Id<"bookings">; message: string; reason: string }
): ResultAsync<null, never> {
	console.error(message, { bookingId, reason });

	return fromConvexTuple(
		ctx.runMutation(internal.bookingConfirmation.markSessionInvoiceEmailFailed, { bookingId })
	)
		.map(invoiceEmailFailureRecorded)
		.orElse((markFailedError: { reason: string }) =>
			logInvoiceEmailFailureMarkFailed(bookingId, markFailedError)
		);
}

function recordReceiptNumberAfterEmail(
	ctx: ActionCtx,
	bookingId: Id<"bookings">,
	{ receiptNumber }: { receiptNumber: string }
) {
	return fromConvexTuple(
		ctx.runMutation(internal.bookingConfirmation.recordBookingReceiptNumber, {
			bookingId,
			receiptNumber
		})
	)
		.map(invoiceEmailFailureRecorded)
		.orElse((recordReceiptError: { reason: string }) =>
			logReceiptNumberRecordFailure(bookingId, recordReceiptError)
		);
}

function logReceiptNumberRecordFailure(
	bookingId: Id<"bookings">,
	recordReceiptError: { reason: string }
) {
	console.error("Failed to store booking receipt number after email send", {
		bookingId,
		reason: recordReceiptError.reason
	});

	return okAsync(null);
}

function sendInvoiceEmailsWithRescheduleUrl(
	ctx: ActionCtx,
	session: Doc<"bookings">,
	settings: SessionAvailabilitySettings,

	rescheduleUrl: string
) {
	return sendBookingReceiptEmailsForBooking(session, {
		leadTimeMinutes: settings.leadTimeMinutes,
		rescheduleUrl
	})
		.andThen((_value) => recordReceiptNumberAfterEmail(ctx, session._id, _value))
		.orElse((error: { reason: string }) => sendInvoiceEmailFailure(ctx, session, error));
}

function sendInvoiceEmailFailure(
	ctx: ActionCtx,
	session: Doc<"bookings">,
	error: { reason: string }
) {
	return recordInvoiceEmailFailure(ctx, {
		bookingId: session._id,
		message: "Booking invoice email failed during booking confirmation",
		reason: error.reason
	});
}

function sendInvoiceWithRescheduleLinkFailure(
	ctx: ActionCtx,
	session: Doc<"bookings">,
	error: { reason: string }
) {
	return recordInvoiceEmailFailure(ctx, {
		bookingId: session._id,
		message: "Booking invoice reschedule link create failed",
		reason: error.reason
	});
}

export function sendConfirmedBookingInvoice(
	ctx: ActionCtx,
	session: Doc<"bookings">,
	settings: SessionAvailabilitySettings
): ResultAsync<null, never> {
	return createRescheduleUrlForSession(ctx, session)
		.andThen((rescheduleUrl: string) =>
			sendInvoiceEmailsWithRescheduleUrl(ctx, session, settings, rescheduleUrl)
		)
		.orElse((error: { reason: string }) =>
			sendInvoiceWithRescheduleLinkFailure(ctx, session, error)
		);
}
