"use node";

import { type ResultAsync } from "neverthrow";

import type { Doc, Id } from "#convex/_generated/dataModel";
import type { ActionCtx } from "#convex/_generated/server";
import { requirePermissionActions } from "#convex/shared/services/requirePermissionActions";
import { sendBookingReceiptEmailsForBooking } from "#convex/booking/services/receiptEmails";
import { validateConfirmedSessionForReceiptResend } from "#convex/booking/lib/receipt";
import { queryBookingAvailabilitySettings } from "#convex/booking/lib/settingsIo";

import { createRescheduleUrlForSession } from "#convex/sessions/lib/rescheduleLinks";
import { getSessionFromQuery } from "#convex/sessions/services/lookup";
import type { BookingAvailabilitySettings } from "#studio/lib/bookingAvailabilitySettings";
import {
	recordReceiptNumberMutation,
	ensureReceiptNumberMutation,
	markReceiptResendSent
} from "#convex/booking/lib/receiptResendSteps";

function recordReceiptNumberBeforeResendSent(
	ctx: ActionCtx,
	session: Doc<"bookings">,
	receiptNumber: string
) {
	return recordReceiptNumberMutation(ctx, session, receiptNumber).andThen(() =>
		markReceiptResendSent(ctx, session)
	);
}

export function loadConfirmedSessionForReceiptResend(
	ctx: ActionCtx,
	args: { bookingId: Id<"bookings"> }
): ResultAsync<Doc<"bookings">, { reason: string }> {
	return requirePermissionActions(ctx, "send:receipt-emails")
		.andThen(() => getSessionFromQuery(ctx, args.bookingId))
		.andThen(validateConfirmedSessionForReceiptResend);
}

export function writeStandaloneBookingReceiptNumber(
	ctx: ActionCtx,
	session: Doc<"bookings">
): ResultAsync<Doc<"bookings">, { reason: string }> {
	return ensureReceiptNumberMutation(ctx, session).map(() => session);
}

export function sendBookingReceiptEmailToCustomer(
	ctx: ActionCtx,
	session: Doc<"bookings">
): ResultAsync<{ receiptNumber: string; session: Doc<"bookings"> }, { reason: string }> {
	return queryBookingAvailabilitySettings(ctx).andThen((settings: BookingAvailabilitySettings) =>
		getSessionFromQuery(ctx, session._id).andThen((sessionFromDb: Doc<"bookings">) =>
			createRescheduleUrlForSession(ctx, sessionFromDb).andThen((rescheduleUrl: string) =>
				sendBookingReceiptEmailsForBooking(sessionFromDb, {
					leadTimeMinutes: settings.leadTimeMinutes,
					rescheduleUrl,
					skipHostEmail: true
				}).map(({ receiptNumber }) => ({ session: sessionFromDb, receiptNumber }))
			)
		)
	);
}

export function recordBookingReceiptResendOutcome(
	ctx: ActionCtx,
	args: { receiptNumber: string; session: Doc<"bookings"> }
): ResultAsync<null, { reason: string }> {
	return recordReceiptNumberBeforeResendSent(ctx, args.session, args.receiptNumber);
}
