import { v } from "convex/values";
import { tupleErr, tupleOk } from "#/lib/result";
import { internalMutation } from "#convex/_generated/server";
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
	handler: (ctx, args) => claimBookingConfirmationService(ctx, args).match(tupleOk, tupleErr)
});

export const markBookingConfirmed = internalMutation({
	args: {
		bookingId: v.id("bookings"),
		googleEventId: v.optional(v.string()),
		googleCalendarId: v.optional(v.string()),
		reservation: sessionReservationValidator
	},
	handler: (ctx, args) => markBookingConfirmedService(ctx, args).match(tupleOk, tupleErr)
});

export const markSessionInvoiceEmailFailed = internalMutation({
	args: { bookingId: v.id("bookings") },
	handler: (ctx, args) => markSessionInvoiceEmailFailedService(ctx, args).match(tupleOk, tupleErr)
});

export const markSessionInvoiceEmailRetrySent = internalMutation({
	args: { bookingId: v.id("bookings") },
	handler: (ctx, args) =>
		markSessionInvoiceEmailRetrySentService(ctx, args).match(tupleOk, tupleErr)
});

export const markBookingConfirmationFailed = internalMutation({
	args: {
		bookingId: v.id("bookings"),
		failureCode: v.string(),
		reservation: v.optional(sessionReservationValidator)
	},
	handler: (ctx, args) => markBookingConfirmationFailedService(ctx, args).match(tupleOk, tupleErr)
});
