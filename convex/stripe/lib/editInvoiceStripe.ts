"use node";

import { err, ok, okAsync, type Result, type ResultAsync } from "neverthrow";
import type Stripe from "stripe";
import { tryPromise } from "#convex/shared/lib/result";
import { isExpectedStripeError } from "#convex/stripe/lib/apiErrors";
import { logError } from "#convex/shared/lib/logger";
import { getStripeClient } from "#convex/stripe/lib/client";
import { BOOKING_INVOICE_CURRENCY } from "#/domain/booking/price-constants";

export function requirePaidCheckoutAmount(
	session: Stripe.Checkout.Session | null
): Result<number | null, { reason: "BILLING_HISTORY_UNAVAILABLE" }> {
	if (session === null) return ok(null);

	if (
		session.currency !== BOOKING_INVOICE_CURRENCY.toLowerCase() ||
		session.amount_total === null ||
		session.payment_status !== "paid"
	) {
		return err({ reason: "BILLING_HISTORY_UNAVAILABLE" });
	}

	return ok(session.amount_total / 100);
}

export function requireStripeCustomerEmail(
	customer: Stripe.Customer | Stripe.DeletedCustomer | null
): Result<string | null, { reason: "STRIPE_CUSTOMER_EMAIL_UNAVAILABLE" }> {
	if (customer === null) return ok(null);

	if (customer.deleted || !customer.email) {
		return err({ reason: "STRIPE_CUSTOMER_EMAIL_UNAVAILABLE" });
	}

	return ok(customer.email);
}

export function retrieveCheckoutSession(
	stripeSessionId: string | null
): ResultAsync<Stripe.Checkout.Session | null, { reason: "STRIPE_CHECKOUT_LOOKUP_FAILED" }> {
	if (stripeSessionId === null) return okAsync(null);

	return tryPromise({
		try: () => getStripeClient().checkout.sessions.retrieve(stripeSessionId),
		catch: (cause) => {
			const failure = { reason: "STRIPE_CHECKOUT_LOOKUP_FAILED" } as const;

			if (!isExpectedStripeError(cause)) {
				logError(
					{ operation: "stripe.checkout.session.lookup", ...failure, stripeSessionId },
					cause
				);
			}

			return failure;
		}
	});
}

export function retrieveStripeCustomer(
	stripeCustomerId: string | null
): ResultAsync<
	(Stripe.Customer | Stripe.DeletedCustomer) | null,
	{ reason: "STRIPE_CUSTOMER_LOOKUP_FAILED" }
> {
	if (stripeCustomerId === null) return okAsync(null);

	return tryPromise({
		try: () => getStripeClient().customers.retrieve(stripeCustomerId),
		catch: (cause) => {
			const failure = { reason: "STRIPE_CUSTOMER_LOOKUP_FAILED" } as const;

			if (!isExpectedStripeError(cause)) {
				logError({ operation: "stripe.customer.lookup", ...failure, stripeCustomerId }, cause);
			}

			return failure;
		}
	});
}
