import type { Doc, Id } from "#convex/_generated/dataModel";
import type { MutationCtx } from "#convex/_generated/server";
import type { BookingSearchPatchOverrides } from "#convex/lib/adminSearch/adminSearchBlob";
import { searchBlobPatchForBookingAsync } from "#convex/lib/adminSearch/adminSearchBlob";
import { okOrThrow } from "#convex/lib/result";
import {
	clearedSessionReservationPatch,
	type SessionReservation
} from "#convex/lib/sessions/sessionReservations";

export function patchBookingStripeConfirmationClaim(
	ctx: MutationCtx,
	bookingId: Id<"bookings">,
	patch: {
		paymentCompletedAt: number;
		bookingConfirmationClaimedAt: number;
		bookingConfirmationEventId: string;
		stripeSessionId: string;
		stripePaymentIntentId?: string;
	}
) {
	return okOrThrow(ctx.db.patch("bookings", bookingId, patch).then(() => null));
}

export function patchBookingReceiptNumber(
	ctx: MutationCtx,
	args: {
		bookingId: Id<"bookings">;
		receiptNumber: string;
		searchBlobPatch: BookingSearchPatchOverrides;
	}
) {
	return okOrThrow(
		ctx.db
			.patch("bookings", args.bookingId, {
				receiptNumber: args.receiptNumber,
				...args.searchBlobPatch
			})
			.then(() => null)
	);
}

export function patchBookingInvoiceEmailFailed(ctx: MutationCtx, bookingId: Id<"bookings">) {
	return okOrThrow(
		ctx.db
			.patch("bookings", bookingId, {
				status: "email_failed",
				bookingFailureCode: "BOOKING_INVOICE_EMAIL_FAILED"
			})
			.then(() => null)
	);
}

export function patchBookingInvoiceEmailFailureCleared(
	ctx: MutationCtx,
	bookingId: Id<"bookings">
) {
	return okOrThrow(
		ctx.db
			.patch("bookings", bookingId, { status: "confirmed", bookingFailureCode: undefined })
			.then(() => null)
	);
}

export function patchPendingBookingConfirmationFailed(
	ctx: MutationCtx,
	args: { bookingId: Id<"bookings">; failureCode: string; reservation?: SessionReservation }
) {
	const basePatch = { status: "failed" as const, bookingFailureCode: args.failureCode };
	const patch = args.reservation ? { ...basePatch, ...clearedSessionReservationPatch } : basePatch;

	return okOrThrow(ctx.db.patch("bookings", args.bookingId, patch).then(() => null));
}

export function patchBookingStripeCheckoutIds(
	ctx: MutationCtx,
	args: { bookingId: Id<"bookings">; stripeSessionId: string; stripeCustomerId: string }
) {
	return okOrThrow(
		ctx.db
			.patch("bookings", args.bookingId, {
				stripeSessionId: args.stripeSessionId,
				stripeCustomerId: args.stripeCustomerId
			})
			.then(() => null)
	);
}

export function patchBookingInstagramHandle(
	ctx: MutationCtx,
	session: Doc<"bookings">,
	patch: { instagramHandle: string; searchBlobPatch: BookingSearchPatchOverrides }
) {
	return okOrThrow(
		ctx.db
			.patch("bookings", session._id, {
				instagramHandle: patch.instagramHandle,
				...patch.searchBlobPatch
			})
			.then(() => null)
	);
}

export function patchBookingReceiptNumberWithSearchBlob(
	ctx: MutationCtx,
	session: Doc<"bookings">,
	receiptNumber: string
) {
	return searchBlobPatchForBookingAsync(ctx, session, { receiptNumber }).andThen(
		(searchBlobPatch) =>
			patchBookingReceiptNumber(ctx, { bookingId: session._id, receiptNumber, searchBlobPatch })
	);
}
