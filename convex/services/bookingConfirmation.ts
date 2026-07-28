import { err, ok } from "neverthrow";
import type { Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { okOrThrow } from "../lib/result";
import { getSessionFromDbResult } from "../lib/sessionLookup";
import {
	clearedSessionReservationPatch,
	sessionHasReservation,
	type SessionReservation
} from "../lib/sessionReservations";

type MarkBookingConfirmedArgs = {
	bookingId: Id<"bookings">;
	googleEventId?: string;
	googleCalendarId?: string;
	reservation: SessionReservation;
};

type MarkBookingConfirmationFailedArgs = {
	bookingId: Id<"bookings">;
	failureCode: string;
	reservation?: SessionReservation;
};

export function markBookingConfirmedService(ctx: MutationCtx, args: MarkBookingConfirmedArgs) {
	return getSessionFromDbResult(ctx, args.bookingId)
		.andThen((session) => {
			if (!sessionHasReservation(session, args.reservation, Date.now())) {
				return err({ reason: "BOOKING_RESERVATION_MISMATCH" as const });
			}

			return ok(session);
		})
		.andThen(() =>
			okOrThrow(
				ctx.db
					.patch(args.bookingId, {
						status: "confirmed",
						googleEventId: args.googleEventId,
						googleCalendarId: args.googleCalendarId,
						bookingConfirmedAt: Date.now(),
						bookingFailureCode: undefined,
						...clearedSessionReservationPatch
					})
					.then(() => null)
			)
		);
}

export function markSessionInvoiceEmailFailedService(
	ctx: MutationCtx,
	args: { bookingId: Id<"bookings"> }
) {
	return getSessionFromDbResult(ctx, args.bookingId).andThen(() =>
		okOrThrow(
			ctx.db
				.patch(args.bookingId, {
					status: "email_failed",
					bookingFailureCode: "BOOKING_INVOICE_EMAIL_FAILED"
				})
				.then(() => null)
		)
	);
}

export function markSessionInvoiceEmailRetrySentService(
	ctx: MutationCtx,
	args: { bookingId: Id<"bookings"> }
) {
	return getSessionFromDbResult(ctx, args.bookingId).andThen((session) => {
		if (session.status !== "email_failed") {
			return ok(null);
		}

		return okOrThrow(
			ctx.db
				.patch(args.bookingId, { status: "confirmed", bookingFailureCode: undefined })
				.then(() => null)
		);
	});
}

export function markBookingConfirmationFailedService(
	ctx: MutationCtx,
	args: MarkBookingConfirmationFailedArgs
) {
	return getSessionFromDbResult(ctx, args.bookingId)
		.andThen((session) => {
			if (args.reservation && !sessionHasReservation(session, args.reservation)) {
				return err({ reason: "BOOKING_RESERVATION_MISMATCH" as const });
			}

			return ok(session);
		})
		.andThen(() =>
			okOrThrow(
				ctx.db
					.patch(args.bookingId, {
						status: "failed",
						bookingFailureCode: args.failureCode,
						...(args.reservation ? clearedSessionReservationPatch : {})
					})
					.then(() => null)
			)
		);
}
