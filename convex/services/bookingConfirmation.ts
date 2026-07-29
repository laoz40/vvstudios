import { err, ok } from "neverthrow";
import type { Doc, Id } from "#convex/_generated/dataModel";
import type { MutationCtx } from "#convex/_generated/server";
import {
	getBookingClaimStatus,
	normalizeBookingId,
	validateClaimStripeSession
} from "#convex/lib/bookingConfirmation";
import { okOrThrow } from "#convex/lib/result";
import { getSessionFromDbResult } from "#convex/lib/sessionLookup";
import {
	clearedSessionReservationPatch,
	sessionHasReservation,
	type SessionReservation
} from "#convex/lib/sessionReservations";

type ClaimBookingConfirmationArgs = {
	bookingId: string;
	stripeSessionId: string;
	stripePaymentIntentId?: string;
	stripeEventId: string;
};

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

type BookingClaimOutcome =
	| { outcome: "already_confirmed" }
	| { outcome: "already_claimed" }
	| {
			outcome: "claimed";
			session: Pick<
				Doc<"bookings">,
				| "_id"
				| "name"
				| "phone"
				| "accountName"
				| "abn"
				| "email"
				| "date"
				| "time"
				| "duration"
				| "service"
				| "addons"
				| "notes"
			>;
	  };

export function claimBookingConfirmationService(
	ctx: MutationCtx,
	args: ClaimBookingConfirmationArgs
) {
	return normalizeBookingId(ctx, args.bookingId)
		.asyncAndThen((bookingId) => getSessionFromDbResult(ctx, bookingId))
		.andThen((session) => validateClaimStripeSession(session, args.stripeSessionId))
		.andThen(getBookingClaimStatus)
		.andThen((status) => {
			if (status.kind !== "pending") {
				return okOrThrow<BookingClaimOutcome>(Promise.resolve({ outcome: status.kind }));
			}

			const { session } = status;
			const now = Date.now();
			return okOrThrow<BookingClaimOutcome>(
				ctx.db
					.patch(session._id, {
						paymentCompletedAt: now,
						bookingConfirmationClaimedAt: now,
						bookingConfirmationEventId: args.stripeEventId,
						stripeSessionId: args.stripeSessionId,
						stripePaymentIntentId: args.stripePaymentIntentId
					})
					.then(() => ({
						outcome: "claimed",
						session: {
							_id: session._id,
							name: session.name,
							phone: session.phone,
							accountName: session.accountName,
							abn: session.abn,
							email: session.email,
							date: session.date,
							time: session.time,
							duration: session.duration,
							service: session.service,
							addons: session.addons,
							notes: session.notes
						}
					}))
			);
		});
}

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
	return getSessionFromDbResult(ctx, args.bookingId).andThen((session) => {
		if (session.status !== "confirmed" && session.status !== "email_failed") {
			return ok(null);
		}

		return okOrThrow(
			ctx.db
				.patch(args.bookingId, {
					status: "email_failed",
					bookingFailureCode: "BOOKING_INVOICE_EMAIL_FAILED"
				})
				.then(() => null)
		);
	});
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
	return getSessionFromDbResult(ctx, args.bookingId).andThen((session) => {
		if (session.status !== "pending_payment") {
			return ok(null);
		}

		if (args.reservation && !sessionHasReservation(session, args.reservation)) {
			return err({ reason: "BOOKING_RESERVATION_MISMATCH" as const });
		}

		return okOrThrow(
			ctx.db
				.patch(args.bookingId, {
					status: "failed",
					bookingFailureCode: args.failureCode,
					...(args.reservation ? clearedSessionReservationPatch : {})
				})
				.then(() => null)
		);
	});
}
