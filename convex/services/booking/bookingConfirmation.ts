import { err, ok } from "neverthrow";
import { exhaustiveCheck } from "#/lib/result";
import type { Doc, Id } from "#convex/_generated/dataModel";
import { internal } from "#convex/_generated/api";
import type { ActionCtx, MutationCtx } from "#convex/_generated/server";
import { searchBlobPatchForBooking } from "#convex/lib/adminSearch/adminSearchBlob";
import { fromConvexTuple, okOrThrow } from "#convex/lib/result";
import {
	bookingReceiptPaidAt,
	resolveBookingReceiptNumber
} from "#studio/features/booking-invoice/lib/receipt-number";
import { getSessionFromDb } from "#convex/lib/sessions/sessionLookup";
import {
	getBookingClaimStatus,
	validateClaimStripeSession
} from "#convex/lib/booking/bookingConfirmationClaim";
import {
	buildConfirmedBookingPatch,
	type MarkBookingConfirmedArgs,
	patchConfirmedBooking,
	requireBookingConfirmationReservation,
	scheduleDriveSetupForConfirmedBooking
} from "#convex/lib/booking/bookingConfirmationSave";
import {
	clearedSessionReservationPatch,
	sessionHasReservation,
	type SessionReservation
} from "#convex/lib/sessions/sessionReservations";

export function assertBookingConfirmationReservation(
	session: Doc<"bookings">,
	reservation: SessionReservation,
	now: number
) {
	return requireBookingConfirmationReservation(session, reservation, now);
}

export function writeConfirmedBooking(
	ctx: MutationCtx,
	args: MarkBookingConfirmedArgs,
	session: Doc<"bookings">
) {
	const confirmedAt = Date.now();

	return okOrThrow(buildConfirmedBookingPatch(ctx, session, args, confirmedAt)).andThen((patch) =>
		patchConfirmedBooking(ctx, args.bookingId, session, patch)
	);
}

export function scheduleConfirmedBookingDriveSetup(ctx: MutationCtx, session: Doc<"bookings">) {
	return scheduleDriveSetupForConfirmedBooking(ctx, session);
}

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

type MarkBookingConfirmationFailedArgs = {
	bookingId: Id<"bookings">;
	failureCode: string;
	reservation?: SessionReservation;
};

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
				const claimOutcome = claim.outcome;

				switch (claimOutcome) {
					case "already_confirmed":
					case "already_claimed":
						return ok<CompleteSessionCheckoutSuccess>({ outcome: claim.outcome });
					case "claimed":
						return fromConvexTuple(
							ctx.runAction(internal.googleCalendar.completeClaimedSession, {
								bookingId: claim.session._id
							})
						).mapErr((error) => ({ kind: "completion_failed" as const, error }));
					default:
						return exhaustiveCheck(claimOutcome);
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
					.patch("bookings", session._id, {
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

export function ensureStandaloneBookingReceiptNumberService(
	ctx: MutationCtx,
	args: { bookingId: Id<"bookings"> }
) {
	return getSessionFromDb(ctx, args.bookingId).andThen((session) => {
		if (session.packageId !== undefined || session.receiptNumber) {
			return ok(null);
		}

		if (session.status !== "confirmed" && session.status !== "email_failed") {
			return ok(null);
		}

		const receiptNumber = resolveBookingReceiptNumber(
			session,
			bookingReceiptPaidAt(session, session.bookingConfirmedAt ?? Date.now())
		);

		return recordBookingReceiptNumberService(ctx, { bookingId: args.bookingId, receiptNumber });
	});
}

export function markSessionInvoiceEmailFailedService(
	ctx: MutationCtx,
	args: { bookingId: Id<"bookings"> }
) {
	return getSessionFromDb(ctx, args.bookingId).andThen((session) => {
		if (session.status !== "confirmed" && session.status !== "email_failed") {
			return ok(null);
		}

		return ensureStandaloneBookingReceiptNumberService(ctx, { bookingId: session._id }).andThen(
			() =>
				okOrThrow(
					ctx.db
						.patch("bookings", args.bookingId, {
							status: "email_failed",
							bookingFailureCode: "BOOKING_INVOICE_EMAIL_FAILED"
						})
						.then(() => null)
				)
		);
	});
}

export function recordBookingReceiptNumberService(
	ctx: MutationCtx,
	args: { bookingId: Id<"bookings">; receiptNumber: string }
) {
	return getSessionFromDb(ctx, args.bookingId).andThen((session) => {
		if (session.receiptNumber === args.receiptNumber) {
			return ok(null);
		}

		return okOrThrow(
			searchBlobPatchForBooking(ctx, session, { receiptNumber: args.receiptNumber }).then(
				(searchBlobPatch) =>
					ctx.db
						.patch("bookings", args.bookingId, {
							receiptNumber: args.receiptNumber,
							...searchBlobPatch
						})
						.then(() => null)
			)
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
				.patch("bookings", args.bookingId, { status: "confirmed", bookingFailureCode: undefined })
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
				.patch(
					"bookings",
					args.bookingId,
					(() => {
						const patch = { status: "failed" as const, bookingFailureCode: args.failureCode };

						if (args.reservation) {
							return { ...patch, ...clearedSessionReservationPatch };
						}

						return patch;
					})()
				)
				.then(() => null)
		);
	});
}
