import { err, ok, okAsync, type ResultAsync } from "neverthrow";
import type { Doc, Id } from "#convex/_generated/dataModel";
import type { MutationCtx } from "#convex/_generated/server";
import {
	getBookingClaimStatus,
	type BookingClaimStatus,
	validateClaimStripeSession
} from "#convex/lib/booking/bookingConfirmationClaim";
import {
	buildConfirmedBookingPatch,
	patchConfirmedBooking,
	requireBookingConfirmationReservation,
	scheduleDriveSetupForConfirmedBooking
} from "#convex/lib/booking/bookingConfirmationSave";
import {
	patchBookingInvoiceEmailFailed,
	patchBookingInvoiceEmailFailureCleared,
	patchBookingReceiptNumber,
	patchBookingStripeConfirmationClaim,
	patchPendingBookingConfirmationFailed
} from "#convex/lib/booking/bookingConfirmationSessionPatches";
import { searchBlobPatchForBookingAsync } from "#convex/lib/adminSearch/adminSearchBlob";
import {
	bookingReceiptPaidAt,
	resolveBookingReceiptNumber
} from "#studio/features/booking-invoice/lib/receipt-number";
import { getSessionFromDb, normalizeBookingId } from "#convex/lib/sessions/sessionLookup";
import {
	sessionHasReservation,
	type SessionReservation
} from "#convex/lib/sessions/sessionReservations";

export type ClaimBookingConfirmationArgs = {
	bookingId: string;
	stripeSessionId: string;
	stripePaymentIntentId?: string;
	stripeEventId: string;
};

export type BookingClaimOutcome =
	| { outcome: "already_confirmed" }
	| { outcome: "already_claimed" }
	| { outcome: "claimed"; session: ReturnType<typeof buildClaimedBookingSession> };

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

export function loadBookingStripeConfirmationClaimStatus(
	ctx: MutationCtx,
	args: ClaimBookingConfirmationArgs
) {
	return normalizeBookingId(ctx, args.bookingId)
		.asyncAndThen((bookingId) => getSessionFromDb(ctx, bookingId))
		.andThen((session) => validateClaimStripeSession(session, args.stripeSessionId))
		.andThen(getBookingClaimStatus);
}

export function writeBookingStripeConfirmationClaim(
	ctx: MutationCtx,
	args: ClaimBookingConfirmationArgs,
	claimStatus: BookingClaimStatus<Doc<"bookings">>
): ResultAsync<BookingClaimOutcome, never> {
	if (claimStatus.kind !== "pending") {
		return okAsync<BookingClaimOutcome>({ outcome: claimStatus.kind });
	}

	const { session } = claimStatus;
	const now = Date.now();

	return patchBookingStripeConfirmationClaim(ctx, session._id, {
		paymentCompletedAt: now,
		bookingConfirmationClaimedAt: now,
		bookingConfirmationEventId: args.stripeEventId,
		stripeSessionId: args.stripeSessionId,
		stripePaymentIntentId: args.stripePaymentIntentId
	}).map(() => ({ outcome: "claimed", session: buildClaimedBookingSession(session) }));
}

export function writeStandaloneBookingReceiptNumberIfMissing(
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

		return writeBookingReceiptNumberOnSession(ctx, { bookingId: args.bookingId, receiptNumber });
	});
}

export function writeBookingReceiptNumberOnSession(
	ctx: MutationCtx,
	args: { bookingId: Id<"bookings">; receiptNumber: string }
) {
	return getSessionFromDb(ctx, args.bookingId).andThen((session) => {
		if (session.receiptNumber === args.receiptNumber) {
			return ok(null);
		}

		return searchBlobPatchForBookingAsync(ctx, session, {
			receiptNumber: args.receiptNumber
		}).andThen((searchBlobPatch) =>
			patchBookingReceiptNumber(ctx, {
				bookingId: args.bookingId,
				receiptNumber: args.receiptNumber,
				searchBlobPatch
			})
		);
	});
}

export function markBookingInvoiceEmailFailedOnSession(
	ctx: MutationCtx,
	args: { bookingId: Id<"bookings"> }
) {
	return getSessionFromDb(ctx, args.bookingId).andThen((session) => {
		if (session.status !== "confirmed" && session.status !== "email_failed") {
			return ok(null);
		}

		return writeStandaloneBookingReceiptNumberIfMissing(ctx, { bookingId: session._id }).andThen(
			() => patchBookingInvoiceEmailFailed(ctx, args.bookingId)
		);
	});
}

export function clearBookingInvoiceEmailFailureOnSession(
	ctx: MutationCtx,
	args: { bookingId: Id<"bookings"> }
) {
	return getSessionFromDb(ctx, args.bookingId).andThen((session) => {
		if (session.status !== "email_failed") {
			return ok(null);
		}

		return patchBookingInvoiceEmailFailureCleared(ctx, args.bookingId);
	});
}

export function markPendingBookingConfirmationFailed(
	ctx: MutationCtx,
	args: { bookingId: Id<"bookings">; failureCode: string; reservation?: SessionReservation }
) {
	return getSessionFromDb(ctx, args.bookingId).andThen((session) => {
		if (session.status !== "pending_payment") {
			return ok(null);
		}

		if (args.reservation && !sessionHasReservation(session, args.reservation)) {
			return err({ reason: "BOOKING_RESERVATION_MISMATCH" as const });
		}

		return patchPendingBookingConfirmationFailed(ctx, args);
	});
}

export function confirmBookingAfterPaymentClaim(
	ctx: MutationCtx,
	args: {
		bookingId: Id<"bookings">;
		googleEventId?: string;
		googleCalendarId?: string;
		reservation: SessionReservation;
	}
) {
	const confirmedAt = Date.now();

	return getSessionFromDb(ctx, args.bookingId)
		.andThen((session) =>
			requireBookingConfirmationReservation(session, args.reservation, confirmedAt)
		)
		.andThen((session) =>
			buildConfirmedBookingPatch(ctx, session, args, confirmedAt).andThen((patch) =>
				patchConfirmedBooking(ctx, args.bookingId, session, patch)
			)
		)
		.andThen((session) => scheduleDriveSetupForConfirmedBooking(ctx, session));
}
