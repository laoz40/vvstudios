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
import {
	searchBlobPatchForBookingAsync,
	type BookingSearchBlobPatch
} from "#convex/lib/adminSearch/adminSearchBlob";
import type { ConfirmedBookingDatabasePatch } from "#convex/lib/booking/bookingConfirmationSave";
import {
	bookingReceiptPaidAt,
	resolveBookingReceiptNumber
} from "#studio/features/booking-invoice/lib/receipt-number";
import { normalizeBookingId } from "#convex/lib/sessions/sessionLookup";
import { getSessionFromDb } from "#convex/services/sessions/sessionLookup";
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

function loadSessionForClaimBookingId(ctx: MutationCtx, bookingId: Id<"bookings">) {
	return getSessionFromDb(ctx, bookingId);
}

function validateClaimForStripeSession(
	args: ClaimBookingConfirmationArgs,
	session: Doc<"bookings">
) {
	return validateClaimStripeSession(session, args.stripeSessionId);
}

function writeStandaloneReceiptIfEligible(
	ctx: MutationCtx,
	args: { bookingId: Id<"bookings"> },
	session: Doc<"bookings">
) {
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
}

function patchReceiptWhenNumberChanged(
	ctx: MutationCtx,
	args: { bookingId: Id<"bookings">; receiptNumber: string },

	session: Doc<"bookings">
) {
	if (session.receiptNumber === args.receiptNumber) {
		return ok(null);
	}

	return searchBlobPatchForBookingAsync(ctx, session, {
		receiptNumber: args.receiptNumber
	}).andThen((searchBlobPatch: BookingSearchBlobPatch) =>
		patchReceiptNumberWithSearchBlob(ctx, args, searchBlobPatch)
	);
}

function patchReceiptNumberWithSearchBlob(
	ctx: MutationCtx,
	args: { bookingId: Id<"bookings">; receiptNumber: string },
	searchBlobPatch: BookingSearchBlobPatch
) {
	return patchBookingReceiptNumber(ctx, {
		bookingId: args.bookingId,
		receiptNumber: args.receiptNumber,
		searchBlobPatch
	});
}

function markInvoiceEmailFailedIfConfirmed(
	ctx: MutationCtx,
	args: { bookingId: Id<"bookings"> },
	session: Doc<"bookings">
) {
	if (session.status !== "confirmed" && session.status !== "email_failed") {
		return ok(null);
	}

	return writeStandaloneBookingReceiptNumberIfMissing(ctx, { bookingId: session._id }).andThen(() =>
		markInvoiceEmailFailedAfterReceipt(ctx, args.bookingId)
	);
}

function markInvoiceEmailFailedAfterReceipt(ctx: MutationCtx, bookingId: Id<"bookings">) {
	return patchBookingInvoiceEmailFailed(ctx, bookingId);
}

function clearInvoiceEmailFailureIfNeeded(
	ctx: MutationCtx,
	args: { bookingId: Id<"bookings"> },
	session: Doc<"bookings">
) {
	if (session.status !== "email_failed") {
		return ok(null);
	}

	return patchBookingInvoiceEmailFailureCleared(ctx, args.bookingId);
}

function markPendingConfirmationFailedIfReserved(
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

function requireConfirmationReservation(
	args: { reservation: SessionReservation; confirmedAt: number },
	session: Doc<"bookings">
) {
	return requireBookingConfirmationReservation(session, args.reservation, args.confirmedAt);
}

function patchConfirmedBookingWithArgs(
	ctx: MutationCtx,
	args: {
		bookingId: Id<"bookings">;
		googleEventId?: string;
		googleCalendarId?: string;
		reservation: SessionReservation;
	},
	confirmedAt: number,

	session: Doc<"bookings">
) {
	return buildConfirmedBookingPatch(ctx, session, args, confirmedAt).andThen(
		(patch: ConfirmedBookingDatabasePatch) =>
			patchConfirmedBookingForSession(ctx, args.bookingId, session, patch)
	);
}

function patchConfirmedBookingForSession(
	ctx: MutationCtx,
	bookingId: Id<"bookings">,
	session: Doc<"bookings">,
	patch: ConfirmedBookingDatabasePatch
) {
	return patchConfirmedBooking(ctx, bookingId, session, patch);
}

function scheduleDriveSetupAfterConfirm(ctx: MutationCtx, session: Doc<"bookings">) {
	return scheduleDriveSetupForConfirmedBooking(ctx, session);
}

export function loadBookingStripeConfirmationClaimStatus(
	ctx: MutationCtx,
	args: ClaimBookingConfirmationArgs
) {
	return normalizeBookingId(ctx, args.bookingId)
		.asyncAndThen((bookingId: Id<"bookings">) => loadSessionForClaimBookingId(ctx, bookingId))
		.andThen((session: Doc<"bookings">) => validateClaimForStripeSession(args, session))
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
	}).map(() => claimedBookingConfirmationOutcome(session));
}

function claimedBookingConfirmationOutcome(session: Doc<"bookings">) {
	return { outcome: "claimed" as const, session: buildClaimedBookingSession(session) };
}

export function writeStandaloneBookingReceiptNumberIfMissing(
	ctx: MutationCtx,
	args: { bookingId: Id<"bookings"> }
) {
	return getSessionFromDb(ctx, args.bookingId).andThen((session: Doc<"bookings">) =>
		writeStandaloneReceiptIfEligible(ctx, args, session)
	);
}

export function writeBookingReceiptNumberOnSession(
	ctx: MutationCtx,
	args: { bookingId: Id<"bookings">; receiptNumber: string }
) {
	return getSessionFromDb(ctx, args.bookingId).andThen((session: Doc<"bookings">) =>
		patchReceiptWhenNumberChanged(ctx, args, session)
	);
}

export function markBookingInvoiceEmailFailedOnSession(
	ctx: MutationCtx,
	args: { bookingId: Id<"bookings"> }
) {
	return getSessionFromDb(ctx, args.bookingId).andThen((session: Doc<"bookings">) =>
		markInvoiceEmailFailedIfConfirmed(ctx, args, session)
	);
}

export function clearBookingInvoiceEmailFailureOnSession(
	ctx: MutationCtx,
	args: { bookingId: Id<"bookings"> }
) {
	return getSessionFromDb(ctx, args.bookingId).andThen((session: Doc<"bookings">) =>
		clearInvoiceEmailFailureIfNeeded(ctx, args, session)
	);
}

export function markPendingBookingConfirmationFailed(
	ctx: MutationCtx,
	args: { bookingId: Id<"bookings">; failureCode: string; reservation?: SessionReservation }
) {
	return getSessionFromDb(ctx, args.bookingId).andThen((session: Doc<"bookings">) =>
		markPendingConfirmationFailedIfReserved(ctx, args, session)
	);
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
		.andThen((session: Doc<"bookings">) =>
			requireConfirmationReservation({ reservation: args.reservation, confirmedAt }, session)
		)
		.andThen((session: Doc<"bookings">) =>
			patchConfirmedBookingWithArgs(ctx, args, confirmedAt, session)
		)
		.andThen((session: Doc<"bookings">) => scheduleDriveSetupAfterConfirm(ctx, session));
}
