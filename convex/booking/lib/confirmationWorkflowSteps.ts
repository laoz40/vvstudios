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
import { logError } from "#convex/shared/lib/logger";

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
	logError({
		operation: "booking.saveConfirmedBooking",
		bookingId: session._id,
		reason: error.reason
	});

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
	logError({
		operation: "booking.recordInvoiceEmailFailure",
		bookingId,
		reason: markFailedError.reason
	});

	return okAsync(null);
}

export function recordInvoiceEmailFailure(
	ctx: ActionCtx,
	{ bookingId }: { bookingId: Id<"bookings"> }
): ResultAsync<null, never> {
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
	logError({
		operation: "booking.recordReceiptNumberAfterEmail",
		bookingId,
		reason: recordReceiptError.reason
	});

	return okAsync(null);
}

export function sendInvoiceEmailFailure(ctx: ActionCtx, session: Doc<"bookings">) {
	return recordInvoiceEmailFailure(ctx, { bookingId: session._id });
}

export function sendInvoiceWithRescheduleLinkFailure(
	ctx: ActionCtx,
	session: Doc<"bookings">,
	error: { reason: string }
) {
	logError({
		operation: "booking.createInvoiceRescheduleLink",
		bookingId: session._id,
		reason: error.reason
	});

	return recordInvoiceEmailFailure(ctx, { bookingId: session._id });
}

export function reminderEmailForWindow(
	session: Doc<"bookings">,
	timeZone: string,
	startDateTime: string,
	rescheduleUrl: string | undefined
) {
	return {
		bookingId: session._id,
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
