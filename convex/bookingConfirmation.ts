import { v } from "convex/values";
import { err as tupleErr, ok as tupleOk } from "#/lib/result";
import type { Id } from "./_generated/dataModel";
import { internalMutation, type MutationCtx } from "./_generated/server";
import { sessionReservationValidator, type SessionReservation } from "./lib/sessionReservations";
import {
	claimBookingConfirmationService,
	markBookingConfirmationFailedService,
	markBookingConfirmedService,
	markSessionInvoiceEmailFailedService,
	markSessionInvoiceEmailRetrySentService
} from "./services/bookingConfirmation";

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
	args: {
		bookingId: string;
		stripeSessionId: string;
		stripePaymentIntentId?: string;
		stripeEventId: string;
	}
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
	args: {
		bookingId: Id<"bookings">;
		googleEventId?: string;
		googleCalendarId?: string;
		reservation: SessionReservation;
	}
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
	args: { bookingId: Id<"bookings">; failureCode: string; reservation?: SessionReservation }
) {
	return markBookingConfirmationFailedService(ctx, args).match(tupleOk, tupleErr);
}
