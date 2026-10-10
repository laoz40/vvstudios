"use node";

import { type ResultAsync } from "neverthrow";
import { api, internal } from "#convex/_generated/api";
import type { Doc, Id } from "#convex/_generated/dataModel";
import type { ActionCtx } from "#convex/_generated/server";
import { requirePermissionActions } from "#convex/shared/services/requirePermissionActions";
import { sendBookingReceiptEmailsForBooking } from "#convex/booking/services/bookingReceiptEmails";
import { validateConfirmedSessionForReceiptResend } from "#convex/booking/lib/bookingReceipt";
import { fromConvexTuple, okOrThrow } from "#convex/shared/lib/result";
import { createRescheduleUrlForSession } from "#convex/sessions/lib/sessionRescheduleLinks";
import { getSessionFromQuery } from "#convex/sessions/services/sessionLookup";
import type { BookingAvailabilitySettings } from "#studio/lib/bookingAvailabilitySettings";

function loadSessionForReceiptResend(ctx: ActionCtx, bookingId: Id<"bookings">) {
	return getSessionFromQuery(ctx, bookingId);
}

function returnSameSession(session: Doc<"bookings">) {
	return session;
}

function sendCustomerReceiptWithSettings(
	ctx: ActionCtx,
	session: Doc<"bookings">,
	settings: BookingAvailabilitySettings
) {
	return getSessionFromQuery(ctx, session._id).andThen((sessionFromDb: Doc<"bookings">) =>
		sendCustomerReceiptForLoadedSession(ctx, settings, sessionFromDb)
	);
}

function sendCustomerReceiptForLoadedSession(
	ctx: ActionCtx,
	settings: BookingAvailabilitySettings,
	sessionFromDb: Doc<"bookings">
) {
	return createRescheduleUrlForSession(ctx, sessionFromDb).andThen((rescheduleUrl: string) =>
		sendReceiptEmailsForRescheduleUrl(sessionFromDb, settings, rescheduleUrl)
	);
}

function sendReceiptEmailsForRescheduleUrl(
	sessionFromDb: Doc<"bookings">,
	settings: BookingAvailabilitySettings,
	rescheduleUrl: string
) {
	return sendBookingReceiptEmailsForBooking(sessionFromDb, {
		leadTimeMinutes: settings.leadTimeMinutes,
		rescheduleUrl,
		skipHostEmail: true
	}).map((_value) => receiptResendResultForSession(sessionFromDb, _value));
}

function receiptResendResultForSession(
	sessionFromDb: Doc<"bookings">,
	{ receiptNumber }: { receiptNumber: string }
) {
	return { session: sessionFromDb, receiptNumber };
}

function markReceiptResendSent(ctx: ActionCtx, session: Doc<"bookings">) {
	return fromConvexTuple(
		ctx.runMutation(internal.booking.bookingConfirmation.markSessionInvoiceEmailRetrySent, {
			bookingId: session._id
		})
	);
}

function recordReceiptNumberBeforeResendSent(
	ctx: ActionCtx,
	session: Doc<"bookings">,
	receiptNumber: string
) {
	return fromConvexTuple(
		ctx.runMutation(internal.booking.bookingConfirmation.recordBookingReceiptNumber, {
			bookingId: session._id,
			receiptNumber
		})
	).andThen(() => markReceiptResendSent(ctx, session));
}

export function loadConfirmedSessionForReceiptResend(
	ctx: ActionCtx,
	args: { bookingId: Id<"bookings"> }
): ResultAsync<Doc<"bookings">, { reason: string }> {
	return requirePermissionActions(ctx, "send:receipt-emails")
		.andThen(() => loadSessionForReceiptResend(ctx, args.bookingId))
		.andThen(validateConfirmedSessionForReceiptResend);
}

export function writeStandaloneBookingReceiptNumber(
	ctx: ActionCtx,
	session: Doc<"bookings">
): ResultAsync<Doc<"bookings">, { reason: string }> {
	return fromConvexTuple(
		ctx.runMutation(internal.booking.bookingConfirmation.ensureStandaloneBookingReceiptNumber, {
			bookingId: session._id
		})
	).map(() => returnSameSession(session));
}

export function sendBookingReceiptEmailToCustomer(
	ctx: ActionCtx,
	session: Doc<"bookings">
): ResultAsync<{ receiptNumber: string; session: Doc<"bookings"> }, { reason: string }> {
	return okOrThrow<BookingAvailabilitySettings>(ctx.runQuery(api.booking.settings.get, {})).andThen(
		(settings: BookingAvailabilitySettings) =>
			sendCustomerReceiptWithSettings(ctx, session, settings)
	);
}

export function recordBookingReceiptResendOutcome(
	ctx: ActionCtx,
	args: { receiptNumber: string; session: Doc<"bookings"> }
): ResultAsync<null, { reason: string }> {
	return recordReceiptNumberBeforeResendSent(ctx, args.session, args.receiptNumber);
}
