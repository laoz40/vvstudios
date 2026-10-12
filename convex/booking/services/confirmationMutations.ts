import { ok, safeTry, type ResultAsync } from "neverthrow";
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
	return safeTry(async function* () {
		const patch = yield* buildConfirmedBookingPatch(ctx, session, args, confirmedAt);
		const confirmedSession = yield* patchConfirmedBooking(ctx, args.bookingId, session, patch);

		return ok(confirmedSession);
	});
}

export function loadBookingStripeConfirmationClaimStatus(
	ctx: MutationCtx,
	args: ClaimBookingConfirmationArgs
) {
	return safeTry(async function* () {
		const bookingId = yield* normalizeBookingId(ctx, args.bookingId);
		const session = yield* getSessionFromDb(ctx, bookingId);
		const claimedSession = yield* validateClaimStripeSession(session, args.stripeSessionId);
		const status = yield* getBookingClaimStatus(claimedSession);

		return ok(status);
	});
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
	return safeTry(async function* () {
		const loaded = yield* loadRequestedReceiptBooking(ctx, args);
		const booking = yield* requireRequestedReceiptBooking(loaded);
		const request = selectMissingStandaloneReceiptRequest(booking);
		const result = yield* writeBookingReceiptNumberOnSession(ctx, request);

		return ok(result);
	});
}

export function writeBookingReceiptNumberOnSession(
	ctx: MutationCtx,
	args: { bookingId: Id<"bookings">; receiptNumber: string } | null
) {
	return safeTry(async function* () {
		const loaded = yield* loadRequestedReceiptBooking(ctx, args);
		const booking = yield* requireRequestedReceiptBooking(loaded);
		const patch = yield* loadChangedReceiptSearchPatch(ctx, booking);
		const result = yield* patchBookingReceiptNumber(ctx, patch);

		return ok(result);
	});
}

export function markBookingInvoiceEmailFailedOnSession(
	ctx: MutationCtx,
	args: { bookingId: Id<"bookings"> }
) {
	return safeTry(async function* () {
		const session = yield* getSessionFromDb(ctx, args.bookingId);
		const request = selectConfirmedInvoiceFailureRequest(session);
		yield* writeStandaloneBookingReceiptNumberIfMissing(ctx, request);
		const result = yield* patchBookingInvoiceEmailFailed(ctx, request?.bookingId ?? null);

		return ok(result);
	});
}

export function clearBookingInvoiceEmailFailureOnSession(
	ctx: MutationCtx,
	args: { bookingId: Id<"bookings"> }
) {
	return safeTry(async function* () {
		const session = yield* getSessionFromDb(ctx, args.bookingId);
		const result = yield* clearInvoiceEmailFailureIfNeeded(ctx, args, session);

		return ok(result);
	});
}

export function markPendingBookingConfirmationFailed(
	ctx: MutationCtx,
	args: { bookingId: Id<"bookings">; failureCode: string; reservation?: SessionReservation }
) {
	return safeTry(async function* () {
		const session = yield* getSessionFromDb(ctx, args.bookingId);
		const result = yield* markPendingConfirmationFailedIfReserved(ctx, args, session);

		return ok(result);
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

	return safeTry(async function* () {
		const session = yield* getSessionFromDb(ctx, args.bookingId);

		const reservedSession = yield* requireBookingConfirmationReservation(
			session,
			args.reservation,
			confirmedAt
		);

		const confirmedSession = yield* patchConfirmedBookingWithArgs(
			ctx,
			args,
			confirmedAt,
			reservedSession
		);

		const result = yield* scheduleDriveSetupForConfirmedBooking(ctx, confirmedSession);

		return ok(result);
	});
}
