"use node";

import { err, ok, type ResultAsync } from "neverthrow";
import { api, internal } from "#convex/_generated/api";
import type { Doc, Id } from "#convex/_generated/dataModel";
import type { ActionCtx } from "#convex/_generated/server";
import { requirePermissionActions } from "#convex/services/requirePermissionActions";
import { sendBookingReceiptEmailsForBooking } from "#convex/lib/booking/bookingDocumentEmails";
import { fromConvexTuple, okOrThrow } from "#convex/lib/result";
import { createRescheduleUrlForSession } from "#convex/lib/sessions/sessionRescheduleLinks";
import { getSessionFromQuery } from "#convex/lib/sessions/sessionLookup";
import type { BookingAvailabilitySettings } from "#studio/lib/bookingAvailabilitySettings";

function isConfirmedBookingStatus(status: string) {
	return status === "confirmed" || status === "email_failed";
}

export function loadConfirmedSessionForReceiptResend(
	ctx: ActionCtx,
	args: { bookingId: Id<"bookings"> }
): ResultAsync<Doc<"bookings">, { reason: string }> {
	return requirePermissionActions(ctx, "send:receipt-emails")
		.andThen(() => getSessionFromQuery(ctx, args.bookingId))
		.andThen((session) => {
			if (!isConfirmedBookingStatus(session.status)) {
				return err({ reason: "BOOKING_NOT_CONFIRMED" as const });
			}

			return ok(session);
		});
}

export function writeStandaloneBookingReceiptNumber(
	ctx: ActionCtx,
	session: Doc<"bookings">
): ResultAsync<Doc<"bookings">, { reason: string }> {
	return fromConvexTuple(
		ctx.runMutation(internal.bookingConfirmation.ensureStandaloneBookingReceiptNumber, {
			bookingId: session._id
		})
	).map(() => session);
}

export function sendBookingReceiptEmailToCustomer(
	ctx: ActionCtx,
	session: Doc<"bookings">
): ResultAsync<{ receiptNumber: string; session: Doc<"bookings"> }, { reason: string }> {
	return okOrThrow<BookingAvailabilitySettings>(ctx.runQuery(api.bookingSettings.get, {})).andThen(
		(settings) =>
			getSessionFromQuery(ctx, session._id).andThen((sessionFromDb) =>
				createRescheduleUrlForSession(ctx, sessionFromDb).andThen((rescheduleUrl) =>
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
	return fromConvexTuple(
		ctx.runMutation(internal.bookingConfirmation.recordBookingReceiptNumber, {
			bookingId: args.session._id,
			receiptNumber: args.receiptNumber
		})
	).andThen(() =>
		fromConvexTuple(
			ctx.runMutation(internal.bookingConfirmation.markSessionInvoiceEmailRetrySent, {
				bookingId: args.session._id
			})
		)
	);
}
