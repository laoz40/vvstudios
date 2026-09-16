"use node";

import { err, ok, type ResultAsync } from "neverthrow";
import { api, internal } from "#convex/_generated/api";
import type { Id } from "#convex/_generated/dataModel";
import type { ActionCtx } from "#convex/_generated/server";
import { requirePermissionActions } from "#convex/lib/auth";
import { sendBookingReceiptEmailsForBooking } from "#convex/lib/bookingDocumentEmails";
import { getPackageForAction } from "#convex/lib/packageLookup";
import { sendAndRecordPackageReceiptEmail } from "#convex/lib/packagePayment";
import { fromConvexTuple, okOrThrow } from "#convex/lib/result";
import { createRescheduleUrlForSession } from "#convex/lib/sessionRescheduleLinks";
import { getSessionFromQuery } from "#convex/lib/sessionLookup";

function isPaidPackageStatus(status: string) {
	return status === "paid" || status === "schedule_email_failed";
}

function isConfirmedBookingStatus(status: string) {
	return status === "confirmed" || status === "email_failed";
}

export function resendBookingReceiptService(
	ctx: ActionCtx,
	args: { bookingId: Id<"bookings"> }
): ResultAsync<null, { reason: string }> {
	return requirePermissionActions(ctx, "send:invoice-emails")
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
				okOrThrow(
					sendBookingReceiptEmailsForBooking(session, {
						leadTimeMinutes: settings.leadTimeMinutes,
						rescheduleUrl,
						skipHostEmail: true
					})
				).andThen((emailResult) => emailResult.map(() => session))
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

export function resendPackageReceiptService(
	ctx: ActionCtx,
	args: { packageId: Id<"packages"> }
): ResultAsync<null, { reason: string }> {
	return requirePermissionActions(ctx, "send:invoice-emails")
		.andThen(() => getPackageForAction(ctx, args.packageId))
		.andThen((packageRecord) => {
			const paidAt = packageRecord.paidAt;

			if (!isPaidPackageStatus(packageRecord.status) || paidAt === undefined) {
				return err({ reason: "PACKAGE_NOT_PAID" as const });
			}

			return ok({ packageRecord, paidAt });
		})
		.andThen(({ packageRecord, paidAt }) =>
			okOrThrow(ctx.runQuery(api.bookingSettings.get, {})).map((settings) => ({
				packageRecord,
				paidAt,
				settings
			}))
		)
		.andThen(({ packageRecord, paidAt, settings }) =>
			sendAndRecordPackageReceiptEmail(
				ctx,
				packageRecord._id,
				packageRecord,
				paidAt,
				settings.leadTimeMinutes
			)
		)
		.map(() => null);
}
