import { v } from "convex/values";
import { err, ok } from "../src/lib/result";
import type { Doc } from "./_generated/dataModel";
import { internalMutation } from "./_generated/server";
import { getSessionFromDb } from "./lib/sessionLookup";
import {
	sessionHasReservation,
	sessionReservationValidator,
	clearedSessionReservationPatch
} from "./lib/sessionReservations";

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
	handler: async (ctx, args) => {
		const [bookingError, session] = await getSessionFromDb(ctx, args.bookingId);

		if (bookingError !== null) {
			return err(bookingError);
		}

		if (!sessionHasReservation(session, args.reservation, Date.now())) {
			return err({ reason: "BOOKING_RESERVATION_MISMATCH" });
		}

		await ctx.db.patch(args.bookingId, {
			status: "confirmed",
			googleEventId: args.googleEventId,
			googleCalendarId: args.googleCalendarId,
			bookingConfirmedAt: Date.now(),
			bookingFailureCode: undefined,
			...clearedSessionReservationPatch
		});

		return ok({ updated: true });
	}
});

export const markSessionInvoiceEmailFailed = internalMutation({
	args: { bookingId: v.id("bookings") },
	handler: async (ctx, args) => {
		const [bookingError] = await getSessionFromDb(ctx, args.bookingId);

		if (bookingError !== null) {
			return err(bookingError);
		}

		await ctx.db.patch(args.bookingId, {
			status: "email_failed",
			bookingFailureCode: "BOOKING_INVOICE_EMAIL_FAILED"
		});

		return ok({ updated: true });
	}
});

export const markSessionInvoiceEmailRetrySent = internalMutation({
	args: { bookingId: v.id("bookings") },
	handler: async (ctx, args) => {
		const [bookingError, session] = await getSessionFromDb(ctx, args.bookingId);

		if (bookingError !== null) {
			return err(bookingError);
		}

		if (session.status !== "email_failed") {
			return ok({ updated: false, reason: "BOOKING_NOT_EMAIL_FAILED" });
		}

		await ctx.db.patch(args.bookingId, { status: "confirmed", bookingFailureCode: undefined });

		return ok({ updated: true });
	}
});

export const markBookingConfirmationFailed = internalMutation({
	args: {
		bookingId: v.id("bookings"),
		failureCode: v.string(),
		reservation: v.optional(sessionReservationValidator)
	},
	handler: async (ctx, args) => {
		const [bookingError, session] = await getSessionFromDb(ctx, args.bookingId);

		if (bookingError !== null) {
			return err(bookingError);
		}

		if (args.reservation !== undefined && !sessionHasReservation(session, args.reservation)) {
			return err({ reason: "BOOKING_RESERVATION_MISMATCH" });
		}

		await ctx.db.patch(args.bookingId, {
			status: "failed",
			bookingFailureCode: args.failureCode,
			...(args.reservation ? clearedSessionReservationPatch : {})
		});

		return ok({ updated: true });
	}
});
