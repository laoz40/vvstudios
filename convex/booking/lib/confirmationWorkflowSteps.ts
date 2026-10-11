"use node";

import { okAsync, type ResultAsync } from "neverthrow";
import { createRescheduleUrlForSession } from "#convex/sessions/lib/rescheduleLinks";
import { internal } from "#convex/_generated/api";
import type { Doc, Id } from "#convex/_generated/dataModel";
import type { ActionCtx } from "#convex/_generated/server";
import { pickBookingAddonQuantities } from "#/domain/booking/addon-quantities";
import { getGoogleCalendarClient } from "#convex/googleCalendar/lib/googleCalendarClient";
import { removeOrphanedSessionCalendarEvent } from "#convex/googleCalendar/lib/googleCalendarEventCalls";
import type { SessionReservation } from "#convex/sessions/lib/reservations";
import { fromConvexTuple } from "#convex/shared/lib/result";
import { exhaustiveCheck } from "#/lib/result";

export function handleSaveConfirmedBookingFailure(
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
		.map(() => false)
		.orElse(() => okAsync(false));
}

export function logInvoiceEmailFailureMarkFailed(
	bookingId: Id<"bookings">,
	markFailedError: { reason: string }
) {
	console.error("Failed to record booking invoice email failure", {
		bookingId,
		reason: markFailedError.reason
	});

	return okAsync(null);
}

export function recordInvoiceEmailFailure(
	ctx: ActionCtx,
	{ bookingId, message, reason }: { bookingId: Id<"bookings">; message: string; reason: string }
): ResultAsync<null, never> {
	console.error(message, { bookingId, reason });

	return fromConvexTuple(
		ctx.runMutation(internal.booking.confirmation.markSessionInvoiceEmailFailed, { bookingId })
	)
		.map(() => null)
		.orElse((markFailedError: { reason: string }) =>
			logInvoiceEmailFailureMarkFailed(bookingId, markFailedError)
		);
}

export function recordReceiptNumberAfterEmail(
	ctx: ActionCtx,
	bookingId: Id<"bookings">,
	{ receiptNumber }: { receiptNumber: string }
) {
	return fromConvexTuple(
		ctx.runMutation(internal.booking.confirmation.recordBookingReceiptNumber, {
			bookingId,
			receiptNumber
		})
	)
		.map(() => null)
		.orElse((recordReceiptError: { reason: string }) =>
			logReceiptNumberRecordFailure(bookingId, recordReceiptError)
		);
}

export function logReceiptNumberRecordFailure(
	bookingId: Id<"bookings">,
	recordReceiptError: { reason: string }
) {
	console.error("Failed to store booking receipt number after email send", {
		bookingId,
		reason: recordReceiptError.reason
	});

	return okAsync(null);
}

export function sendInvoiceEmailFailure(
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

export function sendInvoiceWithRescheduleLinkFailure(
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

export function reminderEmailForWindow(
	session: Doc<"bookings">,
	timeZone: string,
	startDateTime: string,
	rescheduleUrl: string | undefined
) {
	return {
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
	};
}

export function reminderRescheduleUrl(
	ctx: ActionCtx,
	session: Doc<"bookings">
): ResultAsync<string | undefined, { reason: "BOOKING_NOT_FOUND" }> {
	return session.packageId !== undefined
		? okAsync(undefined)
		: createRescheduleUrlForSession(ctx, session);
}

export function markBookingConfirmedMutation(
	ctx: ActionCtx,
	session: Doc<"bookings">,
	calendarClient: ReturnType<typeof getGoogleCalendarClient>,
	reservation: SessionReservation,
	googleEventId: string | undefined
) {
	return fromConvexTuple(
		ctx.runMutation(internal.booking.confirmation.markBookingConfirmed, {
			bookingId: session._id,
			googleEventId,
			googleCalendarId: calendarClient.calendarId,
			reservation
		})
	);
}
