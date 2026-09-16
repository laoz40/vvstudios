"use node";

import { ResultAsync } from "neverthrow";
import { z } from "zod";
import { tryPromise } from "#convex/lib/result";
import type { StripeClient } from "#convex/lib/stripeClient";

export type StripeInvoiceBillingUrls = {
	invoicePdf?: string;
	receiptUrl?: string;
};

const stripeResourceIdSchema = z.union([z.string(), z.object({ id: z.string() })]);

type StripeExpandableResourceId = string | { id: string };

function getStripeResourceId(value: StripeExpandableResourceId | null | undefined) {
	const parsedResourceId = stripeResourceIdSchema.safeParse(value);

	if (!parsedResourceId.success) {
		return undefined;
	}

	const stringResourceId = z.string().safeParse(parsedResourceId.data);

	if (stringResourceId.success) {
		return stringResourceId.data;
	}

	const objectResourceId = z.object({ id: z.string() }).safeParse(parsedResourceId.data);

	return objectResourceId.success ? objectResourceId.data.id : undefined;
}

async function getChargeReceiptUrl(stripe: StripeClient, chargeId: string) {
	const charge = await stripe.charges.retrieve(chargeId);

	return charge.receipt_url ?? undefined;
}

// Charge = the completed card payment. Payment intent = a wrapper Stripe uses for
// newer checkouts; when it succeeds, it creates a charge. Receipt URL is on the charge.
async function getReceiptUrlForPaidInvoice(stripe: StripeClient, stripeInvoiceId: string) {
	const invoicePayments = await stripe.invoicePayments.list({
		invoice: stripeInvoiceId,
		limit: 1
	});

	const payment = invoicePayments.data[0]?.payment;

	if (!payment) {
		return undefined;
	}

	if (payment.type === "charge" && payment.charge) {
		const chargeId = getStripeResourceId(payment.charge);

		if (!chargeId) {
			return undefined;
		}

		return getChargeReceiptUrl(stripe, chargeId);
	}

	if (payment.type === "payment_intent" && payment.payment_intent) {
		const paymentIntentId = getStripeResourceId(payment.payment_intent);

		if (!paymentIntentId) {
			return undefined;
		}

		const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
		const chargeId = getStripeResourceId(paymentIntent.latest_charge);

		if (!chargeId) {
			return undefined;
		}

		return getChargeReceiptUrl(stripe, chargeId);
	}

	return undefined;
}

export function getStripeInvoiceBillingUrls(
	stripe: StripeClient,
	stripeInvoiceId: string
): ResultAsync<StripeInvoiceBillingUrls, { reason: "STRIPE_INVOICE_LOOKUP_FAILED" }> {
	return tryPromise({
		try: async () => {
			const invoice = await stripe.invoices.retrieve(stripeInvoiceId);

			const billingUrls: StripeInvoiceBillingUrls = {
				invoicePdf: invoice.invoice_pdf ?? undefined
			};

			if (invoice.status !== "paid") {
				return billingUrls;
			}

			billingUrls.receiptUrl = await getReceiptUrlForPaidInvoice(stripe, stripeInvoiceId);

			return billingUrls;
		},
		catch: () => ({ reason: "STRIPE_INVOICE_LOOKUP_FAILED" as const })
	});
}
