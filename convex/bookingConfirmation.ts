import { v } from "convex/values";
import { err, err as tupleErr, ok, ok as tupleOk } from "#/lib/result";
import type { Doc, Id } from "./_generated/dataModel";
import { internalMutation, type MutationCtx } from "./_generated/server";
import { sessionReservationValidator, type SessionReservation } from "./lib/sessionReservations";
import {
	markBookingConfirmationFailedService,
	markBookingConfirmedService,
	markSessionInvoiceEmailFailedService,
	markSessionInvoiceEmailRetrySentService
} from "./services/bookingConfirmation";

function getBookingCompletionStatusResult(status: Doc<"bookings">["status"]) {
	switch (status) {
		case "confirmed":
		case "email_failed":
			return ok({ outcome: "already_confirmed" as const });
		case "cancelled":
		case "abandoned":
			return err({ reason: "BOOKING_INVALID_STATUS" as const, status });
		case "expired":
			return err({ reason: "BOOKING_EXPIRED" as const });
		case "failed":
			return err({ reason: "BOOKING_FAILED" as const });
		case "pending_payment":
			return null;
		default: {
			const _exhaustive: never = status;
			return _exhaustive;
		}
	}
}

export const claimBookingConfirmation = internalMutation({
	args: {
		bookingId: v.string(),
		stripeSessionId: v.string(),
		stripePaymentIntentId: v.optional(v.string()),
		stripeEventId: v.string()
	},
	handler: async (ctx, args) => {
		// Stripe metadata provides a plain string, so validate it as a Convex session ID before database access.
		const bookingId = ctx.db.normalizeId("bookings", args.bookingId);

		if (bookingId === null) {
			return err({ reason: "BOOKING_NOT_FOUND" });
		}

		const session = await ctx.db.get(bookingId);

		if (!session) {
			return err({ reason: "BOOKING_NOT_FOUND" });
		}

		if (session.stripeSessionId && session.stripeSessionId !== args.stripeSessionId) {
			return err({ reason: "STRIPE_SESSION_MISMATCH" });
		}

		const statusResult = getBookingCompletionStatusResult(session.status);

		if (statusResult !== null) {
			return statusResult;
		}

		if (session.bookingConfirmationClaimedAt) {
			return ok({ outcome: "already_claimed" });
		}

		const now = Date.now();

		await ctx.db.patch(session._id, {
			paymentCompletedAt: now,
			bookingConfirmationClaimedAt: now,
			bookingConfirmationEventId: args.stripeEventId,
			stripeSessionId: args.stripeSessionId,
			stripePaymentIntentId: args.stripePaymentIntentId
		});

		return ok({
			outcome: "claimed",
			session: {
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
			}
		});
	}
});

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
