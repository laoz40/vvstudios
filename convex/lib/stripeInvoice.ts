"use node";

import { err, ok, type Result } from "neverthrow";
import { ResultAsync } from "neverthrow";
import type { Id } from "#convex/_generated/dataModel";
import { tryPromise } from "#convex/lib/result";
import type { StripeClient } from "#convex/lib/stripeClient";
import { BOOKING_INVOICE_CURRENCY } from "#studio/features/booking-form/lib/booking-pricing";

export const ADMIN_STRIPE_INVOICE_DAYS_UNTIL_DUE = 7;

export type StripeInvoiceLineItem = { description: string; amount: number };

type StripeInvoiceMetadata =
	| { kind: "booking"; bookingId: Id<"bookings">; requestId: string }
	| { kind: "package"; packageId: Id<"packages">; requestId: string };

type CreateStripeInvoiceInput = {
	stripeCustomerId: string;
	lineItems: StripeInvoiceLineItem[];
	metadata: StripeInvoiceMetadata;
};

type StripeInvoiceIdempotencyStep = "create" | "item" | "finalize" | "send";

function audToStripeUnitAmount(amount: number) {
	return Math.round(amount * 100);
}

function stripeInvoiceIdempotencyKey(
	requestId: string,
	step: StripeInvoiceIdempotencyStep,
	lineItemIndex?: number
) {
	if (step === "item" && lineItemIndex !== undefined) {
		return `admin-stripe-invoice-${step}-${requestId}-${lineItemIndex}`;
	}

	return `admin-stripe-invoice-${step}-${requestId}`;
}

export function validateStripeInvoiceLineItems(
	lineItems: StripeInvoiceLineItem[]
): Result<StripeInvoiceLineItem[], { reason: "INVALID_LINE_ITEMS" }> {
	if (lineItems.length === 0) {
		return err({ reason: "INVALID_LINE_ITEMS" });
	}

	const normalizedLineItems: StripeInvoiceLineItem[] = [];

	for (const lineItem of lineItems) {
		const amountInCents = Math.round(lineItem.amount * 100);
		const hasFractionalCents =
			Math.abs(lineItem.amount - amountInCents / 100) > 1e-9;

		if (
			lineItem.description.trim().length === 0 ||
			!Number.isFinite(lineItem.amount) ||
			lineItem.amount <= 0 ||
			hasFractionalCents
		) {
			return err({ reason: "INVALID_LINE_ITEMS" });
		}

		normalizedLineItems.push({
			description: lineItem.description.trim(),
			amount: amountInCents / 100
		});
	}

	return ok(normalizedLineItems);
}

export function createAndSendStripeInvoice(
	stripe: StripeClient,
	input: CreateStripeInvoiceInput
): ResultAsync<{ stripeInvoiceId: string }, { reason: "STRIPE_INVOICE_FAILED" }> {
	const requestId = input.metadata.requestId;

	return tryPromise({
		try: async () => {
			const invoiceMetadata: Record<string, string> =
				input.metadata.kind === "booking"
					? {
							bookingId: input.metadata.bookingId,
							kind: input.metadata.kind,
							requestId: input.metadata.requestId
						}
					: {
							kind: input.metadata.kind,
							packageId: input.metadata.packageId,
							requestId: input.metadata.requestId
						};

			const invoice = await stripe.invoices.create(
				{
					customer: input.stripeCustomerId,
					collection_method: "send_invoice",
					days_until_due: ADMIN_STRIPE_INVOICE_DAYS_UNTIL_DUE,
					metadata: invoiceMetadata
				},
				{ idempotencyKey: stripeInvoiceIdempotencyKey(requestId, "create") }
			);

			await Promise.all(
				input.lineItems.map((lineItem, index) =>
					stripe.invoiceItems.create(
						{
							customer: input.stripeCustomerId,
							invoice: invoice.id,
							amount: audToStripeUnitAmount(lineItem.amount),
							currency: BOOKING_INVOICE_CURRENCY.toLowerCase(),
							description: lineItem.description
						},
						{ idempotencyKey: stripeInvoiceIdempotencyKey(requestId, "item", index) }
					)
				)
			);

			const finalizedInvoice = await stripe.invoices.finalizeInvoice(invoice.id, undefined, {
				idempotencyKey: stripeInvoiceIdempotencyKey(requestId, "finalize")
			});

			await stripe.invoices.sendInvoice(finalizedInvoice.id, undefined, {
				idempotencyKey: stripeInvoiceIdempotencyKey(requestId, "send")
			});

			return finalizedInvoice.id;
		},
		catch: () => ({ reason: "STRIPE_INVOICE_FAILED" as const })
	}).map((stripeInvoiceId) => ({ stripeInvoiceId }));
}
