import { type ResultAsync } from "neverthrow";
import type { Doc, Id } from "#convex/_generated/dataModel";
import type { MutationCtx } from "#convex/_generated/server";
import {
	getBookingClaimStatus,
	validateClaimStripeSession,
	type BookingClaimStatus
} from "#convex/booking/lib/confirmationClaim";
import {
	buildConfirmedBookingPatch,
	patchConfirmedBooking,
	requireBookingConfirmationReservation,
	scheduleDriveSetupForConfirmedBooking
} from "#convex/booking/lib/confirmationSave";
import {
	patchBookingInvoiceEmailFailed,
	patchBookingReceiptNumber
} from "#convex/booking/lib/confirmationSessionPatches";

import type { ConfirmedBookingDatabasePatch } from "#convex/booking/lib/confirmationSave";

import { normalizeBookingId } from "#convex/sessions/lib/lookup";
import { getSessionFromDb } from "#convex/sessions/services/lookup";
import { type SessionReservation } from "#convex/sessions/lib/reservations";
import {
	loadRequestedReceiptBooking,
	requireRequestedReceiptBooking,
	selectMissingStandaloneReceiptRequest,
	loadChangedReceiptSearchPatch,
	selectConfirmedInvoiceFailureRequest,
	writeBookingClaimPatch,
	buildClaimedBookingSession,
	clearInvoiceEmailFailureIfNeeded,
	markPendingConfirmationFailedIfReserved
} from "#convex/booking/lib/confirmationMutationsSteps";

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
			patchConfirmedBooking(ctx, args.bookingId, session, patch)
	);
}

export function loadBookingStripeConfirmationClaimStatus(
	ctx: MutationCtx,
	args: ClaimBookingConfirmationArgs
) {
	return normalizeBookingId(ctx, args.bookingId)
		.asyncAndThen((bookingId: Id<"bookings">) => getSessionFromDb(ctx, bookingId))
		.andThen((session: Doc<"bookings">) =>
			validateClaimStripeSession(session, args.stripeSessionId)
		)
		.andThen(getBookingClaimStatus);
}

export function writeBookingStripeConfirmationClaim(
	ctx: MutationCtx,
	args: ClaimBookingConfirmationArgs,
	claimStatus: BookingClaimStatus<Doc<"bookings">>
): ResultAsync<BookingClaimOutcome, never> {
	return writeBookingClaimPatch(ctx, args, claimStatus);
}

export function writeStandaloneBookingReceiptNumberIfMissing(
	ctx: MutationCtx,
	args: { bookingId: Id<"bookings"> } | null
) {
	return loadRequestedReceiptBooking(ctx, args)
		.andThen(requireRequestedReceiptBooking)
		.map(selectMissingStandaloneReceiptRequest)
		.andThen((request) => writeBookingReceiptNumberOnSession(ctx, request));
}

export function writeBookingReceiptNumberOnSession(
	ctx: MutationCtx,
	args: { bookingId: Id<"bookings">; receiptNumber: string } | null
) {
	return loadRequestedReceiptBooking(ctx, args)
		.andThen(requireRequestedReceiptBooking)
		.andThen((loaded) => loadChangedReceiptSearchPatch(ctx, loaded))
		.andThen((patch) => patchBookingReceiptNumber(ctx, patch));
}

export function markBookingInvoiceEmailFailedOnSession(
	ctx: MutationCtx,
	args: { bookingId: Id<"bookings"> }
) {
	return getSessionFromDb(ctx, args.bookingId)
		.map(selectConfirmedInvoiceFailureRequest)
		.andThen((request) =>
			writeStandaloneBookingReceiptNumberIfMissing(ctx, request).map(() => request)
		)
		.andThen((request) => patchBookingInvoiceEmailFailed(ctx, request?.bookingId ?? null));
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
			requireBookingConfirmationReservation(session, args.reservation, confirmedAt)
		)
		.andThen((session: Doc<"bookings">) =>
			patchConfirmedBookingWithArgs(ctx, args, confirmedAt, session)
		)
		.andThen((session: Doc<"bookings">) => scheduleDriveSetupForConfirmedBooking(ctx, session));
}
