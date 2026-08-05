import { v } from "convex/values";
import { tupleErr, tupleOk } from "#/lib/result";
import type { Id } from "#convex/_generated/dataModel";
import { internalMutation, type MutationCtx } from "#convex/_generated/server";
import { sessionReservationValidator } from "#convex/lib/sessionReservations";
import {
	claimBookingConfirmationService,
	markBookingConfirmationFailedService,
	markBookingConfirmedService,
	markSessionInvoiceEmailFailedService,
	markSessionInvoiceEmailRetrySentService
} from "#convex/services/bookingConfirmation";

export const claimBookingConfirmation = internalMutation({
	args: {
		bookingId: v.string(),
		stripeSessionId: v.string(),
		stripePaymentIntentId: v.optional(v.string()),
		stripeEventId: v.string()
	},
	handler: (ctx, args) => claimBookingConfirmationHandler(ctx, args)
});

function claimBookingConfirmationHandler(
	ctx: MutationCtx,
	args: Parameters<typeof claimBookingConfirmationService>[1]
) {
	return claimBookingConfirmationService(ctx, args).match(tupleOk, tupleErr);
}

export const markBookingConfirmed = internalMutation({
	args: {
		bookingId: v.id("bookings"),
		googleEventId: v.optional(v.string()),
		googleCalendarId: v.optional(v.string()),
		reservation: sessionReservationValidator
	},
	handler: (ctx, args) => markBookingConfirmedHandler(ctx, args)
});

function markBookingConfirmedHandler(
	ctx: MutationCtx,
	args: Parameters<typeof markBookingConfirmedService>[1]
) {
	return markBookingConfirmedService(ctx, args).match(tupleOk, tupleErr);
}

export const markSessionInvoiceEmailFailed = internalMutation({
	args: { bookingId: v.id("bookings") },
	handler: (ctx, args) => markSessionInvoiceEmailFailedHandler(ctx, args)
});

function markSessionInvoiceEmailFailedHandler(
	ctx: MutationCtx,
	args: { bookingId: Id<"bookings"> }
) {
	return markSessionInvoiceEmailFailedService(ctx, args).match(tupleOk, tupleErr);
}

export const markSessionInvoiceEmailRetrySent = internalMutation({
	args: { bookingId: v.id("bookings") },
	handler: (ctx, args) => markSessionInvoiceEmailRetrySentHandler(ctx, args)
});

function markSessionInvoiceEmailRetrySentHandler(
	ctx: MutationCtx,
	args: { bookingId: Id<"bookings"> }
) {
	return markSessionInvoiceEmailRetrySentService(ctx, args).match(tupleOk, tupleErr);
}

export const markBookingConfirmationFailed = internalMutation({
	args: {
		bookingId: v.id("bookings"),
		failureCode: v.string(),
		reservation: v.optional(sessionReservationValidator)
	},
	handler: (ctx, args) => markBookingConfirmationFailedHandler(ctx, args)
});

function markBookingConfirmationFailedHandler(
	ctx: MutationCtx,
	args: Parameters<typeof markBookingConfirmationFailedService>[1]
) {
	return markBookingConfirmationFailedService(ctx, args).match(tupleOk, tupleErr);
}
