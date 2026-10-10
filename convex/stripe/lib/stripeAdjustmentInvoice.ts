"use node";

import type Stripe from "stripe";
import type { Id } from "#convex/_generated/dataModel";
import { PACKAGE_ADJUSTMENT_PAYMENT_DUE_MS } from "#convex/packages/lib/packageAdjustments";
import { tryPromise } from "#convex/shared/lib/result";
import { stripeApiFailureReason } from "#convex/stripe/lib/stripeApiErrors";
import type { StripeClient } from "#convex/stripe/lib/stripeClient";

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
		catch: stripeApiFailureReason
	}).map((invoice) => invoice.id);
}

export function findPackageAdjustmentStripeProduct(
	stripe: StripeClient,
	params: Stripe.ProductSearchParams
) {
	return tryPromise({
		try: () => stripe.products.search(params),
		catch: stripeApiFailureReason
	}).map((products) => products.data[0]?.id);
}

export function createPackageAdjustmentStripeProduct(
	stripe: StripeClient,
	params: Stripe.ProductCreateParams
) {
	return tryPromise({
		try: () => stripe.products.create(params),
		catch: stripeApiFailureReason
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
		catch: stripeApiFailureReason
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
		catch: stripeApiFailureReason
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
		catch: stripeApiFailureReason
	}).map(() => null);
}
