"use node";

import { err, ok, type ResultAsync } from "neverthrow";
import { api, internal } from "#convex/_generated/api";
import type { Id } from "#convex/_generated/dataModel";
import type { ActionCtx } from "#convex/_generated/server";
import { requirePermissionActions } from "#convex/services/auth";
import { sendBookingReceiptEmailsForBooking } from "#convex/lib/booking/bookingDocumentEmails";
import { fromConvexTuple, okOrThrow } from "#convex/lib/result";
import { createRescheduleUrlForSession } from "#convex/lib/sessions/sessionRescheduleLinks";
import { getSessionFromQuery } from "#convex/lib/sessions/sessionLookup";

function isConfirmedBookingStatus(status: string) {
	return status === "confirmed" || status === "email_failed";
}

export function resendBookingReceiptService(
	ctx: ActionCtx,
	args: { bookingId: Id<"bookings"> }
): ResultAsync<null, { reason: string }> {
	return requirePermissionActions(ctx, "send:receipt-emails")
		.andThen(() => getSessionFromQuery(ctx, args.bookingId))
		.andThen((session) => {
			if (!isConfirmedBookingStatus(session.status)) {
				return err({ reason: "BOOKING_NOT_CONFIRMED" as const });
			}

			return ok(session);
		})
		.andThen((session) =>
			fromConvexTuple(
				ctx.runMutation(internal.bookingConfirmation.ensureStandaloneBookingReceiptNumber, {
					bookingId: session._id
				})
			).map(() => session)
		)
		.andThen((session) =>
			okOrThrow(ctx.runQuery(api.bookingSettings.get, {})).map((settings) => ({
				session,
				settings
			}))
		)
		.andThen(({ session, settings }) =>
			getSessionFromQuery(ctx, session._id).andThen((sessionFromDb) =>
				createRescheduleUrlForSession(ctx, sessionFromDb).andThen((rescheduleUrl) =>
					sendBookingReceiptEmailsForBooking(sessionFromDb, {
						leadTimeMinutes: settings.leadTimeMinutes,
						rescheduleUrl,
						skipHostEmail: true
					}).map(({ receiptNumber }) => ({ session: sessionFromDb, receiptNumber }))
				)
			)
		)
		.andThen(({ session, receiptNumber }) =>
			fromConvexTuple(
				ctx.runMutation(internal.bookingConfirmation.recordBookingReceiptNumber, {
					bookingId: session._id,
					receiptNumber
				})
			).andThen(() =>
				fromConvexTuple(
					ctx.runMutation(internal.bookingConfirmation.markSessionInvoiceEmailRetrySent, {
						bookingId: session._id
					})
				)
			)
		)
		.map(() => null);
}
