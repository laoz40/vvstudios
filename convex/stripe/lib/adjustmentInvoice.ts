"use node";

import { logError } from "#convex/shared/lib/logger";

import type Stripe from "stripe";
import type { Id } from "#convex/_generated/dataModel";
import { PACKAGE_ADJUSTMENT_PAYMENT_DUE_MS } from "#convex/packages/lib/adjustments";
import { tryPromise } from "#convex/shared/lib/result";
import { isExpectedStripeError, stripeApiFailureReason } from "#convex/stripe/lib/apiErrors";
import type { StripeClient } from "#convex/stripe/lib/client";

const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;

export const PACKAGE_ADJUSTMENT_STRIPE_INVOICE_DAYS_UNTIL_DUE = Math.round(
	PACKAGE_ADJUSTMENT_PAYMENT_DUE_MS / MILLISECONDS_PER_DAY
);

type PackageAdjustmentInvoiceIdempotencyStep = "create" | "item" | "finalize" | "send";

function packageAdjustmentInvoiceIdempotencyKey(
	adjustmentId: Id<"packageAdjustments">,
	step: PackageAdjustmentInvoiceIdempotencyStep
) {
	return `package-adjustment-invoice-${step}-${adjustmentId}`;
}

export function createPackageAdjustmentStripeInvoice(
	stripe: StripeClient,
	adjustmentId: Id<"packageAdjustments">,
	params: Stripe.InvoiceCreateParams
) {
	return tryPromise({
		try: () =>
			stripe.invoices.create(params, {
				idempotencyKey: packageAdjustmentInvoiceIdempotencyKey(adjustmentId, "create")
			}),
		catch: (cause) => {
			const failure = stripeApiFailureReason(cause);

			if (!isExpectedStripeError(cause)) {
				logError(
					{
						operation: "stripe.packageAdjustment.invoice.create",
						reason: failure.reason,
						adjustmentId
					},
					cause
				);
			}

			return failure;
		}
	}).map((invoice) => invoice.id);
}

export function findPackageAdjustmentStripeProduct(
	stripe: StripeClient,
	params: Stripe.ProductSearchParams
) {
	return tryPromise({
		try: () => stripe.products.search(params),
		catch: (cause) => {
			const failure = stripeApiFailureReason(cause);

			if (!isExpectedStripeError(cause)) {
				logError(
					{ operation: "stripe.packageAdjustment.product.search", reason: failure.reason },
					cause
				);
			}

			return failure;
		}
	}).map((products) => products.data[0]?.id);
}

export function createPackageAdjustmentStripeProduct(
	stripe: StripeClient,
	params: Stripe.ProductCreateParams
) {
	return tryPromise({
		try: () => stripe.products.create(params),
		catch: (cause) => {
			const failure = stripeApiFailureReason(cause);

			if (!isExpectedStripeError(cause)) {
				logError(
					{ operation: "stripe.packageAdjustment.product.create", reason: failure.reason },
					cause
				);
			}

			return failure;
		}
	}).map((product) => product.id);
}

export function createPackageAdjustmentStripeInvoiceItem(
	stripe: StripeClient,
	adjustmentId: Id<"packageAdjustments">,
	params: Stripe.InvoiceItemCreateParams
) {
	return tryPromise({
		try: () =>
			stripe.invoiceItems.create(params, {
				idempotencyKey: packageAdjustmentInvoiceIdempotencyKey(adjustmentId, "item")
			}),
		catch: (cause) => {
			const failure = stripeApiFailureReason(cause);

			if (!isExpectedStripeError(cause)) {
				logError(
					{
						operation: "stripe.packageAdjustment.invoiceItem.create",
						reason: failure.reason,
						adjustmentId
					},
					cause
				);
			}

			return failure;
		}
	}).map(() => null);
}

export function finalizePackageAdjustmentStripeInvoice(
	stripe: StripeClient,
	adjustmentId: Id<"packageAdjustments">,
	stripeInvoiceId: string
) {
	return tryPromise({
		try: () =>
			stripe.invoices.finalizeInvoice(stripeInvoiceId, undefined, {
				idempotencyKey: packageAdjustmentInvoiceIdempotencyKey(adjustmentId, "finalize")
			}),
		catch: (cause) => {
			const failure = stripeApiFailureReason(cause);

			if (!isExpectedStripeError(cause)) {
				logError(
					{
						operation: "stripe.packageAdjustment.invoice.finalize",
						reason: failure.reason,
						adjustmentId
					},
					cause
				);
			}

			return failure;
		}
	}).map((invoice) => invoice.id);
}

export function sendPackageAdjustmentStripeInvoice(
	stripe: StripeClient,
	adjustmentId: Id<"packageAdjustments">,
	stripeInvoiceId: string
) {
	return tryPromise({
		try: () =>
			stripe.invoices.sendInvoice(stripeInvoiceId, undefined, {
				idempotencyKey: packageAdjustmentInvoiceIdempotencyKey(adjustmentId, "send")
			}),
		catch: (cause) => {
			const failure = stripeApiFailureReason(cause);

			if (!isExpectedStripeError(cause)) {
				logError(
					{
						operation: "stripe.packageAdjustment.invoice.send",
						reason: failure.reason,
						adjustmentId
					},
					cause
				);
			}

			return failure;
		}
	}).map(() => null);
}
