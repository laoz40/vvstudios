"use node";

import { err, ok, okAsync, type Result } from "neverthrow";
import { ResultAsync } from "neverthrow";
import { internal } from "#convex/_generated/api";
import type { Id } from "#convex/_generated/dataModel";
import type { ActionCtx } from "#convex/_generated/server";
import { fromConvexTuple, tryPromise } from "#convex/shared/lib/result";
import type { EditInvoiceTarget } from "#convex/stripe/lib/editInvoiceDb";
import type { StripeClient } from "#convex/stripe/lib/client";
import { isExpectedStripeError } from "#convex/stripe/lib/apiErrors";
import { logError } from "#convex/shared/lib/logger";
import { BOOKING_INVOICE_CURRENCY } from "#/domain/booking/price-constants";

export const ADMIN_STRIPE_INVOICE_DAYS_UNTIL_DUE = 7;

export type StripeInvoiceLineItem = { description: string; amount: number };

export type StripeInvoiceSenderIdentity = { email?: string };

export function requireStripeInvoiceCustomerId(stripeCustomerId: string | undefined) {
	if (!stripeCustomerId) {
		return err({ reason: "STRIPE_CUSTOMER_NOT_FOUND" as const });
	}

	return ok(stripeCustomerId);
}

export function createAndSendBookingStripeInvoice(
	stripe: StripeClient,
	args: { bookingId: Id<"bookings">; lineItems: StripeInvoiceLineItem[]; requestId: string },
	stripeCustomerId: string
) {
	return createAndSendStripeInvoice(stripe, {
		stripeCustomerId,
		lineItems: args.lineItems,
		metadata: { kind: "booking", bookingId: args.bookingId, requestId: args.requestId }
	});
}

export function createAndSendPackageStripeInvoice(
	stripe: StripeClient,
	args: { packageId: Id<"packages">; lineItems: StripeInvoiceLineItem[]; requestId: string },
	stripeCustomerId: string
) {
	return createAndSendStripeInvoice(stripe, {
		stripeCustomerId,
		lineItems: args.lineItems,
		metadata: { kind: "package", packageId: args.packageId, requestId: args.requestId }
	});
}

export function recordBookingStripeInvoiceFromAction(
	ctx: ActionCtx,
	args: { bookingId: Id<"bookings">; lineItems: StripeInvoiceLineItem[]; requestId: string },
	identity: StripeInvoiceSenderIdentity,
	stripeInvoiceId: string
) {
	return ctx.runMutation(internal.stripe.invoiceRecords.recordBookingStripeInvoice, {
		bookingId: args.bookingId,
		stripeInvoiceId,
		lineItems: args.lineItems,
		requestId: args.requestId,
		createdBy: identity.email
	});
}

export function recordPackageStripeInvoiceFromAction(
	ctx: ActionCtx,
	args: { packageId: Id<"packages">; lineItems: StripeInvoiceLineItem[]; requestId: string },
	identity: StripeInvoiceSenderIdentity,
	stripeInvoiceId: string
) {
	return ctx.runMutation(internal.stripe.invoiceRecords.recordPackageStripeInvoice, {
		packageId: args.packageId,
		stripeInvoiceId,
		lineItems: args.lineItems,
		requestId: args.requestId,
		createdBy: identity.email
	});
}

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
		const hasFractionalCents = Math.abs(lineItem.amount - amountInCents / 100) > 1e-9;

		if (
			lineItem.description.trim().length === 0 ||
			!Number.isFinite(lineItem.amount) ||
			lineItem.amount === 0 ||
			hasFractionalCents
		) {
			return err({ reason: "INVALID_LINE_ITEMS" });
		}

		normalizedLineItems.push({
			description: lineItem.description.trim(),
			amount: amountInCents / 100
		});
	}

	return normalizedLineItems.reduce(
		(total, line) => total + audToStripeUnitAmount(line.amount),
		0
	) > 0
		? ok(normalizedLineItems)
		: err({ reason: "INVALID_LINE_ITEMS" });
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
		catch: (cause) => {
			if (!isExpectedStripeError(cause)) {
				logError(
					{
						operation: "stripe.invoice.createAndSend",
						reason: "STRIPE_INVOICE_FAILED",
						bookingId: input.metadata.kind === "booking" ? input.metadata.bookingId : undefined,
						packageId: input.metadata.kind === "package" ? input.metadata.packageId : undefined
					},
					cause
				);
			}

			return { reason: "STRIPE_INVOICE_FAILED" as const };
		}
	}).map((stripeInvoiceId) => ({ stripeInvoiceId }));
}

export function createAndSendOptionalEditInvoice(
	stripe: StripeClient,
	input: {
		stripeCustomerId: string;
		lineItems: StripeInvoiceLineItem[];
		requestId: string;
		target: EditInvoiceTarget | null;
	}
): ResultAsync<{ stripeInvoiceId: string } | null, { reason: "STRIPE_INVOICE_FAILED" }> {
	if (input.target === null) return okAsync(null);

	const metadata: StripeInvoiceMetadata =
		input.target.kind === "booking"
			? { kind: "booking", bookingId: input.target.bookingId, requestId: input.requestId }
			: { kind: "package", packageId: input.target.packageId, requestId: input.requestId };

	return createAndSendStripeInvoice(stripe, {
		stripeCustomerId: input.stripeCustomerId,
		lineItems: input.lineItems,
		metadata
	});
}

export function recordOptionalEditInvoiceFromAction(
	ctx: ActionCtx,
	args: {
		target: EditInvoiceTarget | null;
		lineItems: StripeInvoiceLineItem[];
		requestId: string;
		createdBy?: string;
		stripeInvoiceId: string | null;
	}
) {
	if (args.target === null || args.stripeInvoiceId === null) return okAsync(null);

	return args.target.kind === "booking"
		? fromConvexTuple(
				ctx.runMutation(internal.stripe.invoiceRecords.recordBookingStripeInvoice, {
					bookingId: args.target.bookingId,
					stripeInvoiceId: args.stripeInvoiceId,
					lineItems: args.lineItems,
					requestId: args.requestId,
					createdBy: args.createdBy
				})
			)
		: fromConvexTuple(
				ctx.runMutation(internal.stripe.invoiceRecords.recordPackageStripeInvoice, {
					packageId: args.target.packageId,
					stripeInvoiceId: args.stripeInvoiceId,
					lineItems: args.lineItems,
					requestId: args.requestId,
					createdBy: args.createdBy
				})
			);
}
