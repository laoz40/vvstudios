import { err, ok, ResultAsync, type Result } from "neverthrow";
import type { Doc, Id } from "#convex/_generated/dataModel";
import { internal } from "#convex/_generated/api";
import type { ActionCtx, MutationCtx } from "#convex/_generated/server";
import { scheduleDriveSetup } from "#convex/lib/driveScheduling";
import { fromConvexTuple, okOrThrow } from "#convex/lib/result";
import { getSessionFromDb } from "#convex/lib/sessionLookup";
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

export type CompleteClaimedSessionSuccess = {
	outcome:
		| "already_completed"
		| "completed"
		| "booking_time_unavailable"
		| "booking_invalid_input"
		| "google_calendar_create_failed"
		| "reservation_lost";
};

type CompleteSessionCheckoutSuccess =
	| CompleteClaimedSessionSuccess
	| { outcome: "already_confirmed" | "already_claimed" };

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

type BookingClaimStatus =
	| { kind: "already_confirmed" }
	| { kind: "already_claimed" }
	| { kind: "pending"; session: Doc<"bookings"> };

type BookingClaimStatusError =
	| { reason: "BOOKING_INVALID_STATUS"; status: "cancelled" | "abandoned" }
	| { reason: "BOOKING_EXPIRED" }
	| { reason: "BOOKING_FAILED" };

type BookingClaimOutcome =
	| { outcome: "already_confirmed" }
	| { outcome: "already_claimed" }
	| { outcome: "claimed"; session: ReturnType<typeof buildClaimedBookingSession> };

function normalizeBookingId(ctx: MutationCtx, bookingId: string) {
	// Stripe metadata provides a plain string, so validate it before database access.
	const normalizedBookingId = ctx.db.normalizeId("bookings", bookingId);
	return normalizedBookingId
		? ok(normalizedBookingId)
		: err({ reason: "BOOKING_NOT_FOUND" as const });
}

function validateClaimStripeSession(session: Doc<"bookings">, stripeSessionId: string) {
	if (session.stripeSessionId && session.stripeSessionId !== stripeSessionId) {
		return err({ reason: "STRIPE_SESSION_MISMATCH" as const });
	}

	return ok(session);
}

function getBookingClaimStatus(
	session: Doc<"bookings">
): Result<BookingClaimStatus, BookingClaimStatusError> {
	switch (session.status) {
		case "confirmed":
		case "email_failed":
			return ok({ kind: "already_confirmed" });
		case "cancelled":
		case "abandoned":
			return err({ reason: "BOOKING_INVALID_STATUS", status: session.status });
		case "expired":
			return err({ reason: "BOOKING_EXPIRED" });
		case "failed":
			return err({ reason: "BOOKING_FAILED" });
		case "pending_payment":
			return session.bookingConfirmationClaimedAt
				? ok({ kind: "already_claimed" })
				: ok({ kind: "pending", session });
		default: {
			const _exhaustive: never = session.status;
			return _exhaustive;
		}
	}
}

function buildClaimedBookingSession(session: Doc<"bookings">) {
	return {
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
	};
}

export function completeSessionCheckoutService(ctx: ActionCtx, args: ClaimBookingConfirmationArgs) {
	return (
		fromConvexTuple(ctx.runMutation(internal.bookingConfirmation.claimBookingConfirmation, args))
			.mapErr((error) => ({ kind: "claim_failed" as const, error }))
			// Complete provider work only when this webhook acquired the booking claim.
			.andThen((claim) => {
				switch (claim.outcome) {
					case "already_confirmed":
					case "already_claimed":
						return ok<CompleteSessionCheckoutSuccess>({ outcome: claim.outcome });
					case "claimed":
						return fromConvexTuple(
							ctx.runAction(internal.googleCalendar.completeClaimedSession, {
								bookingId: claim.session._id
							})
						).mapErr((error) => ({ kind: "completion_failed" as const, error }));
					default: {
						const _exhaustive: never = claim;
						return _exhaustive;
					}
				}
			})
	);
}

export function claimBookingConfirmationService(
	ctx: MutationCtx,
	args: ClaimBookingConfirmationArgs
) {
	return normalizeBookingId(ctx, args.bookingId)
		.asyncAndThen((bookingId) => getSessionFromDb(ctx, bookingId))
		.andThen((session) => validateClaimStripeSession(session, args.stripeSessionId))
		.andThen(getBookingClaimStatus)
		.andThen((status) => {
			if (status.kind !== "pending") {
				return ok<BookingClaimOutcome>({ outcome: status.kind });
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
					.then(() => ({ outcome: "claimed", session: buildClaimedBookingSession(session) }))
			);
		});
}

export function markBookingConfirmedService(ctx: MutationCtx, args: MarkBookingConfirmedArgs) {
	return (
		getSessionFromDb(ctx, args.bookingId)
			// Check that this attempt still holds the booking time.
			.andThen((session) => {
				if (!sessionHasReservation(session, args.reservation, Date.now())) {
					return err({ reason: "BOOKING_RESERVATION_MISMATCH" as const });
				}

				return ok(session);
			})
			// Save the confirmed status and Calendar IDs while clearing the temporary time-slot reservation.
			.andThen((session) =>
				okOrThrow(
					ctx.db.patch(args.bookingId, {
						status: "confirmed",
						googleEventId: args.googleEventId,
						googleCalendarId: args.googleCalendarId,
						bookingConfirmedAt: Date.now(),
						bookingFailureCode: undefined,
						...clearedSessionReservationPatch
					})
				).andThen(() =>
					ResultAsync.fromSafePromise(
						scheduleDriveSetup(ctx, {
							bookingId: session._id,
							sessionStartAt: session.sessionStartAt,
							duration: session.duration,
							multiBookingPackageId: session.multiBookingPackageId
						})
					).andThen((scheduled) => scheduled)
				)
			)
	);
}

export function markSessionInvoiceEmailFailedService(
	ctx: MutationCtx,
	args: { bookingId: Id<"bookings"> }
) {
	return getSessionFromDb(ctx, args.bookingId).andThen((session) => {
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
	return getSessionFromDb(ctx, args.bookingId).andThen((session) => {
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
	return getSessionFromDb(ctx, args.bookingId).andThen((session) => {
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
