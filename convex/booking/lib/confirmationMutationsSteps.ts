import { err, ok, okAsync, type Result, type ResultAsync } from "neverthrow";
import type { Doc, Id } from "#convex/_generated/dataModel";
import type { MutationCtx } from "#convex/_generated/server";
import type { BookingClaimStatus } from "#convex/booking/lib/confirmationClaim";
import {
	patchBookingInvoiceEmailFailureCleared,
	patchBookingStripeConfirmationClaim,
	patchPendingBookingConfirmationFailed
} from "#convex/booking/lib/confirmationSessionPatches";

import { getBookingRow } from "#convex/sessions/lib/lookup";
import { searchBlobPatchForBookingAsync } from "#convex/shared/lib/adminSearch/adminSearchBlob";
import {
	bookingReceiptPaidAt,
	resolveBookingReceiptNumber
} from "#studio/features/booking-invoice/lib/receipt-number";
import { sessionHasReservation, type SessionReservation } from "#convex/sessions/lib/reservations";

export type ClaimBookingConfirmationArgs = {
	bookingId: string;
	stripeSessionId: string;
	stripePaymentIntentId?: string;
	originalPaidAmount?: number;
	stripeEventId: string;
};

export type BookingClaimOutcome =
	| { outcome: "already_confirmed" }
	| { outcome: "already_claimed" }
	| { outcome: "claimed"; session: ReturnType<typeof buildClaimedBookingSession> };

export function buildClaimedBookingSession(session: Doc<"bookings">) {
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

export function clearInvoiceEmailFailureIfNeeded(
	ctx: MutationCtx,
	args: { bookingId: Id<"bookings"> },
	session: Doc<"bookings">
) {
	if (session.status !== "email_failed") {
		return ok(null);
	}

	return patchBookingInvoiceEmailFailureCleared(ctx, args.bookingId);
}

export function markPendingConfirmationFailedIfReserved(
	ctx: MutationCtx,
	args: { bookingId: Id<"bookings">; failureCode: string; reservation?: SessionReservation },

	session: Doc<"bookings">
) {
	if (session.status !== "pending_payment") {
		return ok(null);
	}

	if (args.reservation && !sessionHasReservation(session, args.reservation)) {
		return err({ reason: "BOOKING_RESERVATION_MISMATCH" as const });
	}

	return patchPendingBookingConfirmationFailed(ctx, args);
}

export function writeBookingClaimPatch(
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
		originalPaidAmount: args.originalPaidAmount,
		stripePaymentIntentId: args.stripePaymentIntentId
	}).map(() => ({ outcome: "claimed" as const, session: buildClaimedBookingSession(session) }));
}

type ReceiptWriteRequest = { bookingId: Id<"bookings">; receiptNumber: string };

type ReceiptBookingRequest = { bookingId: Id<"bookings"> };

export function loadRequestedReceiptBooking<T extends ReceiptBookingRequest>(
	ctx: MutationCtx,
	request: T | null
): ResultAsync<{ request: T; session: Doc<"bookings"> | null } | null, never> {
	if (request === null) return okAsync(null);

	return getBookingRow(ctx, request.bookingId).map((session) => ({ request, session }));
}

export function requireRequestedReceiptBooking<T extends ReceiptBookingRequest>(
	loaded: { request: T; session: Doc<"bookings"> | null } | null
): Result<{ request: T; session: Doc<"bookings"> } | null, { reason: "BOOKING_NOT_FOUND" }> {
	if (loaded === null) return ok(null);

	if (loaded.session === null) return err({ reason: "BOOKING_NOT_FOUND" });

	return ok({ request: loaded.request, session: loaded.session });
}

export function selectMissingStandaloneReceiptRequest(
	loaded: { request: ReceiptBookingRequest; session: Doc<"bookings"> } | null
): ReceiptWriteRequest | null {
	if (loaded === null) return null;
	const { session, request } = loaded;

	if (
		session.packageId !== undefined ||
		session.receiptNumber ||
		(session.status !== "confirmed" && session.status !== "email_failed")
	)
		return null;

	return {
		bookingId: request.bookingId,
		receiptNumber: resolveBookingReceiptNumber(
			session,
			bookingReceiptPaidAt(session, session.bookingConfirmedAt ?? Date.now())
		)
	};
}

export function loadChangedReceiptSearchPatch(
	ctx: MutationCtx,
	loaded: { request: ReceiptWriteRequest; session: Doc<"bookings"> } | null
) {
	if (loaded === null || loaded.session.receiptNumber === loaded.request.receiptNumber)
		return okAsync(null);

	return searchBlobPatchForBookingAsync(ctx, loaded.session, {
		receiptNumber: loaded.request.receiptNumber
	}).map((searchBlobPatch) => ({ ...loaded.request, searchBlobPatch }));
}

export function selectConfirmedInvoiceFailureRequest(
	session: Doc<"bookings">
): ReceiptBookingRequest | null {
	if (session.status !== "confirmed" && session.status !== "email_failed") return null;

	return { bookingId: session._id };
}
