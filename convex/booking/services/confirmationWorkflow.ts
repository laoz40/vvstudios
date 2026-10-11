"use node";

import { type ResultAsync } from "neverthrow";
import { createRescheduleUrlForSession } from "#convex/sessions/lib/rescheduleLinks";

import type { Doc } from "#convex/_generated/dataModel";
import type { ActionCtx } from "#convex/_generated/server";

import { getGoogleCalendarClient } from "#convex/googleCalendar/lib/googleCalendarClient";

import {
	buildEventWindow,
	type SessionAvailabilitySettings
} from "#convex/sessions/lib/calendarTime";
import type { SessionReservation } from "#convex/sessions/lib/reservations";

import { sendBookingReceiptEmailsForBooking } from "#convex/booking/services/receiptEmails";
import { sendSessionReminderEmail } from "#convex/email/services/bookingCustomerEmails";
import {
	reminderEmailForWindow,
	reminderRescheduleUrl,
	markBookingConfirmedMutation,
	sendInvoiceEmailFailure,
	sendInvoiceWithRescheduleLinkFailure,
	handleSaveConfirmedBookingFailure,
	recordReceiptNumberAfterEmail
} from "#convex/booking/lib/confirmationWorkflowSteps";

function sendReminderEmailForSessionWindow(
	session: Doc<"bookings">,
	timeZone: string,
	startDateTime: string,

	rescheduleUrl: string | undefined
) {
	return sendSessionReminderEmail(
		reminderEmailForWindow(session, timeZone, startDateTime, rescheduleUrl)
	);
}

function sendReminderAfterEventWindow(
	ctx: ActionCtx,
	session: Doc<"bookings">,
	timeZone: string,
	startDateTime: string
) {
	return reminderRescheduleUrl(ctx, session).andThen((rescheduleUrl: string | undefined) =>
		sendReminderEmailForSessionWindow(session, timeZone, startDateTime, rescheduleUrl)
	);
}

export function sendBookingReminderEmailForSession(ctx: ActionCtx, session: Doc<"bookings">) {
	const { timeZone } = getGoogleCalendarClient();

	return buildEventWindow(session.date, session.time, session.duration, timeZone).asyncAndThen(
		({ startDateTime }) => sendReminderAfterEventWindow(ctx, session, timeZone, startDateTime)
	);
}

export function saveConfirmedBooking(
	ctx: ActionCtx,
	session: Doc<"bookings">,
	calendarClient: ReturnType<typeof getGoogleCalendarClient>,
	reservation: SessionReservation,
	googleEventId: string | undefined
): ResultAsync<boolean, never> {
	return markBookingConfirmedMutation(ctx, session, calendarClient, reservation, googleEventId)
		.map(() => true)
		.orElse(
			(
				error:
					| { reason: "BOOKING_NOT_FOUND" }
					| { reason: "BOOKING_RESERVATION_MISMATCH" }
					| { reason: "BOOKING_INVALID_DURATION" }
			) => handleSaveConfirmedBookingFailure(ctx, session, googleEventId, calendarClient, error)
		);
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
