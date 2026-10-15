"use node";

import { ok, safeTry, type ResultAsync } from "neverthrow";
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
	return safeTry(async function* () {
		const rescheduleUrl = yield* reminderRescheduleUrl(ctx, session);

		const result = yield* sendReminderEmailForSessionWindow(
			session,
			timeZone,
			startDateTime,
			rescheduleUrl
		);

		return ok(result);
	});
}

export function sendBookingReminderEmailForSession(ctx: ActionCtx, session: Doc<"bookings">) {
	const { timeZone } = getGoogleCalendarClient();

	return safeTry(async function* () {
		const { startDateTime } = yield* buildEventWindow(
			session.date,
			session.time,
			session.duration,
			timeZone
		);

		const result = yield* sendReminderAfterEventWindow(ctx, session, timeZone, startDateTime);

		return ok(result);
	});
}

export function saveConfirmedBooking(
	ctx: ActionCtx,
	session: Doc<"bookings">,
	calendarClient: ReturnType<typeof getGoogleCalendarClient>,
	reservation: SessionReservation,
	googleEventId: string | undefined
): ResultAsync<boolean, never> {
	return safeTry(async function* () {
		yield* markBookingConfirmedMutation(ctx, session, calendarClient, reservation, googleEventId);

		return ok(true);
	}).orElse((error) =>
		handleSaveConfirmedBookingFailure(ctx, session, googleEventId, calendarClient, error)
	);
}

function sendInvoiceEmailsWithRescheduleUrl(
	ctx: ActionCtx,
	session: Doc<"bookings">,
	settings: SessionAvailabilitySettings,

	rescheduleUrl: string
) {
	return safeTry(async function* () {
		const receipt = yield* sendBookingReceiptEmailsForBooking(session, {
			leadTimeMinutes: settings.leadTimeMinutes,
			rescheduleUrl
		});

		const result = yield* recordReceiptNumberAfterEmail(ctx, session._id, receipt);

		return ok(result);
	}).orElse(() => sendInvoiceEmailFailure(ctx, session));
}

export function sendConfirmedBookingInvoice(
	ctx: ActionCtx,
	session: Doc<"bookings">,
	settings: SessionAvailabilitySettings
): ResultAsync<null, never> {
	return safeTry(async function* () {
		const rescheduleUrl = yield* createRescheduleUrlForSession(ctx, session);
		const result = yield* sendInvoiceEmailsWithRescheduleUrl(ctx, session, settings, rescheduleUrl);

		return ok(result);
	}).orElse((error: { reason: string }) =>
		sendInvoiceWithRescheduleLinkFailure(ctx, session, error)
	);
}
