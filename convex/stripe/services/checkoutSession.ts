"use node";

import { type ResultAsync } from "neverthrow";
import type Stripe from "stripe";

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

export function parsePublicBookingForCheckout(
	args: CreateEmbeddedCheckoutSessionArgs
): ResultAsync<BookingFormValues, { reason: "BOOKING_INVALID_INPUT" }> {
	return parsePublicCheckoutBooking(args);
}

export function runSessionCheckoutSubmitRateLimit(
	ctx: ActionCtx,
	booking: BookingFormValues
): ResultAsync<
	BookingFormValues,
	{ reason: "BOOKING_RATE_LIMITED"; retryAfter?: number } | CreateEmbeddedCheckoutSessionError
> {
	return getBookingSubmitRateLimitKey(booking.email).andThen((submitRateLimitKey: string) =>
		enforceSessionSubmitRateLimit(ctx, booking, submitRateLimitKey)
	);
}

export function createPendingBookingForStripeCheckout(
	ctx: ActionCtx,
	booking: BookingFormValues
): ResultAsync<
	{
		booking: BookingFormValues;
		bookingId: Id<"bookings">;
		lineItems: Parameters<typeof createStripeCheckoutCustomer>[2]["lineItems"];
	},
	CreateEmbeddedCheckoutSessionError
> {
	return requireBookingEmailDomain(booking.email).andThen(() =>
		createPendingSessionForCheckout(ctx, booking).andThen(({ bookingId }) =>
			buildSessionCheckoutLineItems(booking).map((lineItems) => ({ booking, bookingId, lineItems }))
		)
	);
}

export function openEmbeddedBookingStripeCheckout(
	ctx: ActionCtx,
	checkoutDraft: {
		booking: BookingFormValues;
		bookingId: Id<"bookings">;
		lineItems: Parameters<typeof createStripeCheckoutCustomer>[2]["lineItems"];
	}
): ResultAsync<
	{ bookingId: Id<"bookings">; clientSecret: string; stripeSessionId: string },
	CreateEmbeddedCheckoutSessionError
> {
	const stripe = getStripeClient();

	return createStripeCheckoutCustomer(stripe, checkoutDraft.booking, {
		bookingId: checkoutDraft.bookingId,
		lineItems: checkoutDraft.lineItems
	})
		.andThen((draft) => createEmbeddedStripeCheckoutSession(stripe, draft))
		.andThen((draft) => linkStripeCheckoutToPendingBooking(ctx, draft));
}

export function closeAbandonedBookingStripeCheckout(
	ctx: ActionCtx,
	args: { bookingId: Id<"bookings">; stripeSessionId: string }
): ResultAsync<CloseEmbeddedCheckoutSessionSuccess, CloseEmbeddedCheckoutSessionError> {
	const stripe = getStripeClient();

	return closeOpenStripeCheckoutSession(stripe, args.stripeSessionId, args).andThen(
		(session: Stripe.Checkout.Session) => resolveClosedBookingCheckoutSession(ctx, args, session)
	);
}
