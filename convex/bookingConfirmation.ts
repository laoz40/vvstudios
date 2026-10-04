import { v } from "convex/values";
import { tupleErr, tupleOk } from "#/lib/result";
import { internalMutation } from "#convex/_generated/server";
import { sessionReservationValidator } from "#convex/lib/sessions/sessionReservations";
import {
	buildConfirmedBookingPatch,
	patchConfirmedBooking,
	requireBookingConfirmationReservation,
	scheduleDriveSetupForConfirmedBooking
} from "#convex/lib/booking/bookingConfirmationSave";
import { getSessionFromDb } from "#convex/lib/sessions/sessionLookup";
import { okOrThrow } from "#convex/lib/result";
import {
	claimBookingConfirmationService,
	ensureStandaloneBookingReceiptNumberService,
	markBookingConfirmationFailedService,
	markSessionInvoiceEmailFailedService,
	markSessionInvoiceEmailRetrySentService,
	recordBookingReceiptNumberService
} from "#convex/services/booking/bookingConfirmation";

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
	handler: (ctx, args) => {
		const confirmedAt = Date.now();

		return getSessionFromDb(ctx, args.bookingId)
			.andThen((session) =>
				requireBookingConfirmationReservation(session, args.reservation, confirmedAt)
			)
			.andThen((session) =>
				okOrThrow(buildConfirmedBookingPatch(ctx, session, args, confirmedAt)).andThen((patch) =>
					patchConfirmedBooking(ctx, args.bookingId, session, patch)
				)
			)
			.andThen((session) => scheduleDriveSetupForConfirmedBooking(ctx, session))
			.match(tupleOk, tupleErr);
	}
});

export const ensureStandaloneBookingReceiptNumber = internalMutation({
	args: { bookingId: v.id("bookings") },
	handler: (ctx, args) =>
		ensureStandaloneBookingReceiptNumberService(ctx, args).match(tupleOk, tupleErr)
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

export const recordBookingReceiptNumber = internalMutation({
	args: { bookingId: v.id("bookings"), receiptNumber: v.string() },
	handler: (ctx, args) => recordBookingReceiptNumberService(ctx, args).match(tupleOk, tupleErr)
});

export const markBookingConfirmationFailed = internalMutation({
	args: {
		bookingId: v.id("bookings"),
		failureCode: v.string(),
		reservation: v.optional(sessionReservationValidator)
	},
	handler: (ctx, args) => markBookingConfirmationFailedService(ctx, args).match(tupleOk, tupleErr)
});
