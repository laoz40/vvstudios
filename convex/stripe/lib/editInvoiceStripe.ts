"use node";

import { err, errAsync, ok, okAsync, type ResultAsync } from "neverthrow";
import type { Doc } from "#convex/_generated/dataModel";
import type { EditInvoiceDraft } from "#convex/stripe/services/editInvoiceValidators";
import type { EditInvoiceContext, EditInvoiceQuote } from "#convex/stripe/lib/editInvoiceBilling";
import { tryPromise } from "#convex/shared/lib/result";
import { getStripeClient } from "#convex/stripe/lib/client";
import { BOOKING_INVOICE_CURRENCY } from "#/domain/booking/price-constants";

export function readCheckoutPaidAmount(stripeSessionId: string) {
	return tryPromise({
		try: () => getStripeClient().checkout.sessions.retrieve(stripeSessionId),
		catch: () => ({ reason: "STRIPE_CHECKOUT_LOOKUP_FAILED" as const })
	}).andThen((session) => {
		if (
			session.currency !== BOOKING_INVOICE_CURRENCY.toLowerCase() ||
			session.amount_total === null ||
			session.payment_status !== "paid"
		) {
			return err({ reason: "BILLING_HISTORY_UNAVAILABLE" as const });
		}

		return ok(session.amount_total / 100);
	});
}

export function readStripeInvoiceRecipient(
	stripeCustomerId: string | null
): ResultAsync<string, { reason: string }> {
	if (!stripeCustomerId) return errAsync({ reason: "STRIPE_CUSTOMER_NOT_FOUND" });

	return tryPromise({
		try: () => getStripeClient().customers.retrieve(stripeCustomerId),
		catch: () => ({ reason: "STRIPE_CUSTOMER_LOOKUP_FAILED" as const })
	}).andThen((customer) => {
		if (customer.deleted || !customer.email)
			return err({ reason: "STRIPE_CUSTOMER_EMAIL_UNAVAILABLE" as const });

		return ok(customer.email);
	});
}

export function loadCheckoutPayment(
	record: Doc<"bookings"> | Doc<"packages">
): ResultAsync<number | null, { reason: string }> {
	if (record.originalPaidAmount !== undefined) return okAsync(record.originalPaidAmount);

	if (record.stripeSessionId) return readCheckoutPaidAmount(record.stripeSessionId);

	return okAsync(null);
}

export function loadQuoteRecipient(
	draft: EditInvoiceDraft | undefined,
	context: EditInvoiceContext,
	quote: EditInvoiceQuote
) {
	if (!draft || quote.amount <= 0) return okAsync(quote);

	return readStripeInvoiceRecipient(context.record.stripeCustomerId ?? null).map(
		(customerEmail) => ({ ...quote, customerEmail })
	);
}
