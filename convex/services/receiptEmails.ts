"use node";

import { err, ok, type ResultAsync } from "neverthrow";
import { api, internal } from "#convex/_generated/api";
import type { Id } from "#convex/_generated/dataModel";
import type { ActionCtx } from "#convex/_generated/server";
import { requirePermissionActions } from "#convex/lib/auth";
import { sendBookingReceiptEmailsForBooking } from "#convex/lib/bookingDocumentEmails";
import { fromConvexTuple, okOrThrow } from "#convex/lib/result";
import { createRescheduleUrlForSession } from "#convex/lib/sessionRescheduleLinks";
import { getSessionFromQuery } from "#convex/lib/sessionLookup";

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
			okOrThrow(ctx.runQuery(api.bookingSettings.get, {})).map((settings) => ({
				session,
				settings
			}))
		)
		.andThen(({ session, settings }) =>
			createRescheduleUrlForSession(ctx, session).andThen((rescheduleUrl) =>
				sendBookingReceiptEmailsForBooking(session, {
					leadTimeMinutes: settings.leadTimeMinutes,
					rescheduleUrl,
					skipHostEmail: true
				}).map(() => session)
			)
		)
		.andThen((session) =>
			fromConvexTuple(
				ctx.runMutation(internal.bookingConfirmation.markSessionInvoiceEmailRetrySent, {
					bookingId: session._id
				})
			).map(() => null)
		);
}
