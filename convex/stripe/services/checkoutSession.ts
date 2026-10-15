"use node";

import { type ResultAsync, ok, safeTry } from "neverthrow";

import type { Id } from "#convex/_generated/dataModel";
import type { ActionCtx } from "#convex/_generated/server";
import { getBookingSubmitRateLimitKey } from "#convex/booking/lib/submission";

import { requireBookingEmailDomain } from "#convex/shared/services/bookingEmailDomain";
import { getStripeClient } from "#convex/stripe/lib/client";

import {
	closeOpenStripeCheckoutSession,
	createEmbeddedStripeCheckoutSession,
	createPendingSessionForCheckout,
	createStripeCheckoutCustomer,
	linkStripeCheckoutToPendingBooking
} from "#convex/stripe/lib/checkoutSession";
import type { SessionAvailabilityValidationError } from "#convex/sessions/lib/calendarTime";
import { type BookingFormValues } from "#studio/features/booking-form/lib/booking-form-model";
import {
	type CreateEmbeddedCheckoutSessionArgs as LibCreateEmbeddedCheckoutSessionArgs,
	parsePublicCheckoutBooking,
	enforceSessionSubmitRateLimit,
	resolveClosedBookingCheckoutSession
} from "#convex/stripe/lib/checkoutSessionSteps";
import { buildSessionCheckoutLineItems } from "#studio/features/booking-invoice/lib/stripe-checkout-line-items";

export type CreateEmbeddedCheckoutSessionArgs = LibCreateEmbeddedCheckoutSessionArgs;

export type CreateEmbeddedCheckoutSessionError =
	| { reason: "BOOKING_EMAIL_DOMAIN_INVALID" }
	| { reason: "BOOKING_INVALID_DURATION" }
	| { reason: "BOOKING_INVALID_INPUT" }
	| { reason: "BOOKING_RATE_LIMITED"; retryAfter?: number }
	| { reason: "STRIPE_CHECKOUT_CREATE_FAILED" }
	| SessionAvailabilityValidationError;

export type CloseEmbeddedCheckoutSessionError =
	| { reason: "STRIPE_CHECKOUT_CLOSE_FAILED" }
	| { reason: "STRIPE_SESSION_MISMATCH" };

type CloseEmbeddedCheckoutSessionSuccess = {
	outcome: "already_complete" | "abandoned" | "not_found" | "not_pending";
};

export function parsePublicBookingForCheckout(args: CreateEmbeddedCheckoutSessionArgs) {
	return parsePublicCheckoutBooking(args);
}

export function runSessionCheckoutSubmitRateLimit(ctx: ActionCtx, booking: BookingFormValues) {
	return safeTry(async function* () {
		const rateLimitKey = yield* getBookingSubmitRateLimitKey(booking.email);
		const rateLimitResult = yield* enforceSessionSubmitRateLimit(ctx, booking, rateLimitKey);

		return ok(rateLimitResult);
	});
}

export function createPendingBookingForStripeCheckout(ctx: ActionCtx, booking: BookingFormValues) {
	return safeTry(async function* () {
		yield* requireBookingEmailDomain(booking.email);
		const { bookingId } = yield* createPendingSessionForCheckout(ctx, booking);
		const lineItems = yield* buildSessionCheckoutLineItems(booking);

		return ok({ booking, bookingId, lineItems });
	});
}

export function openEmbeddedBookingStripeCheckout(
	ctx: ActionCtx,
	checkoutDraft: {
		booking: BookingFormValues;
		bookingId: Id<"bookings">;
		lineItems: Parameters<typeof createStripeCheckoutCustomer>[2]["lineItems"];
	}
) {
	const stripe = getStripeClient();

	return safeTry(async function* () {
		const checkoutCustomer = yield* createStripeCheckoutCustomer(stripe, checkoutDraft.booking, {
			bookingId: checkoutDraft.bookingId,
			lineItems: checkoutDraft.lineItems
		});

		const checkoutSession = yield* createEmbeddedStripeCheckoutSession(stripe, checkoutCustomer);
		const linkedSession = yield* linkStripeCheckoutToPendingBooking(ctx, checkoutSession);

		return ok(linkedSession);
	});
}

export function closeAbandonedBookingStripeCheckout(
	ctx: ActionCtx,
	args: { bookingId: Id<"bookings">; stripeSessionId: string }
): ResultAsync<CloseEmbeddedCheckoutSessionSuccess, CloseEmbeddedCheckoutSessionError> {
	const stripe = getStripeClient();

	return safeTry(async function* () {
		const closedSession = yield* closeOpenStripeCheckoutSession(stripe, args);
		const result = yield* resolveClosedBookingCheckoutSession(ctx, args, closedSession);

		return ok(result);
	});
}
