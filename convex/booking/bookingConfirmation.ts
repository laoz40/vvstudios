import { v } from "convex/values";
import { tupleErr, tupleOk } from "#/lib/result";
import { internalMutation } from "#convex/_generated/server";
import { sessionReservationValidator } from "#convex/sessions/services/sessionReservationValidators";
import {
	clearBookingInvoiceEmailFailureOnSession,
	confirmBookingAfterPaymentClaim,
	loadBookingStripeConfirmationClaimStatus,
	markBookingInvoiceEmailFailedOnSession,
	markPendingBookingConfirmationFailed,
	writeBookingReceiptNumberOnSession,
	writeBookingStripeConfirmationClaim,
	writeStandaloneBookingReceiptNumberIfMissing
} from "#convex/booking/services/bookingConfirmationMutations";

export const claimBookingConfirmation = internalMutation({
	args: {
		bookingId: v.string(),
		stripeSessionId: v.string(),
		originalPaidAmount: v.optional(v.number()),
		stripePaymentIntentId: v.optional(v.string()),
		stripeEventId: v.string()
	},
	handler: (ctx, args) =>
		loadBookingStripeConfirmationClaimStatus(ctx, args)
			.andThen((claimStatus) => writeBookingStripeConfirmationClaim(ctx, args, claimStatus))
			.match(tupleOk, tupleErr)
});

export const markBookingConfirmed = internalMutation({
	args: {
		bookingId: v.id("bookings"),
		googleEventId: v.optional(v.string()),
		googleCalendarId: v.optional(v.string()),
		reservation: sessionReservationValidator
	},
	handler: (ctx, args) => confirmBookingAfterPaymentClaim(ctx, args).match(tupleOk, tupleErr)
});

export const ensureStandaloneBookingReceiptNumber = internalMutation({
	args: { bookingId: v.id("bookings") },
	handler: (ctx, args) =>
		writeStandaloneBookingReceiptNumberIfMissing(ctx, args).match(tupleOk, tupleErr)
});

export const markSessionInvoiceEmailFailed = internalMutation({
	args: { bookingId: v.id("bookings") },
	handler: (ctx, args) => markBookingInvoiceEmailFailedOnSession(ctx, args).match(tupleOk, tupleErr)
});

export const markSessionInvoiceEmailRetrySent = internalMutation({
	args: { bookingId: v.id("bookings") },
	handler: (ctx, args) =>
		clearBookingInvoiceEmailFailureOnSession(ctx, args).match(tupleOk, tupleErr)
});

export const recordBookingReceiptNumber = internalMutation({
	args: { bookingId: v.id("bookings"), receiptNumber: v.string() },
	handler: (ctx, args) => writeBookingReceiptNumberOnSession(ctx, args).match(tupleOk, tupleErr)
});

export const markBookingConfirmationFailed = internalMutation({
	args: {
		bookingId: v.id("bookings"),
		failureCode: v.string(),
		reservation: v.optional(sessionReservationValidator)
	},
	handler: (ctx, args) => markPendingBookingConfirmationFailed(ctx, args).match(tupleOk, tupleErr)
});
