"use node";

import { ResultAsync } from "neverthrow";
import type { Id } from "#convex/_generated/dataModel";
import {
	PACKAGE_ADJUSTMENT_PAYMENT_DUE_MS,
	REMOTE_PODCAST_ADJUSTMENT_RATE
} from "#convex/lib/packageAdjustments";
import { tryPromise } from "#convex/lib/result";
import type { StripeClient } from "#convex/lib/stripeClient";
import { getCustomerAddonDisplayLabel } from "#studio/features/booking-form/lib/booking-form-model";
import { BOOKING_INVOICE_CURRENCY } from "#studio/features/booking-form/lib/booking-pricing";

const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;

export const PACKAGE_ADJUSTMENT_STRIPE_INVOICE_DAYS_UNTIL_DUE = Math.round(
	PACKAGE_ADJUSTMENT_PAYMENT_DUE_MS / MILLISECONDS_PER_DAY
);

function audToStripeUnitAmount(amount: number) {
	return Math.round(amount * 100);
}

const PACKAGE_ADJUSTMENT_PRODUCT_METADATA_KIND = "package_adjustment_remote_podcast";

async function getPackageAdjustmentRemotePodcastProductId(
	stripe: StripeClient,
	productName: string
) {
	const existingProducts = await stripe.products.search({
		query: `metadata['kind']:'${PACKAGE_ADJUSTMENT_PRODUCT_METADATA_KIND}' AND active:'true'`,
		limit: 1
	});

	const existingProduct = existingProducts.data[0];

	if (existingProduct !== undefined) {
		return existingProduct.id;
	}

	const product = await stripe.products.create({
		name: productName,
		metadata: { kind: PACKAGE_ADJUSTMENT_PRODUCT_METADATA_KIND }
	});

	return product.id;
}

type CreatePackageAdjustmentStripeInvoiceInput = {
	adjustmentId: Id<"packageAdjustments">;
	packageId: Id<"packages">;
	stripeCustomerId: string;
	quantity: number;
};

type PackageAdjustmentInvoiceIdempotencyStep = "create" | "item" | "finalize" | "send";

function packageAdjustmentInvoiceIdempotencyKey(
	adjustmentId: Id<"packageAdjustments">,
	step: PackageAdjustmentInvoiceIdempotencyStep
) {
	return `package-adjustment-invoice-${step}-${adjustmentId}`;
}

export function createAndSendPackageAdjustmentStripeInvoice(
	stripe: StripeClient,
	input: CreatePackageAdjustmentStripeInvoiceInput
): ResultAsync<{ stripeInvoiceId: string }, { reason: "STRIPE_ADJUSTMENT_INVOICE_FAILED" }> {
	const remotePodcastLabel = getCustomerAddonDisplayLabel("Remote Podcast");
	const unitAmount = audToStripeUnitAmount(REMOTE_PODCAST_ADJUSTMENT_RATE);

	return tryPromise({
		try: async () => {
			const invoice = await stripe.invoices.create(
				{
					customer: input.stripeCustomerId,
					collection_method: "send_invoice",
					days_until_due: PACKAGE_ADJUSTMENT_STRIPE_INVOICE_DAYS_UNTIL_DUE,
					metadata: { adjustmentId: input.adjustmentId, packageId: input.packageId }
				},
				{
					idempotencyKey: packageAdjustmentInvoiceIdempotencyKey(input.adjustmentId, "create")
				}
			);

			const productId = await getPackageAdjustmentRemotePodcastProductId(
				stripe,
				remotePodcastLabel
			);

			await stripe.invoiceItems.create(
				{
					customer: input.stripeCustomerId,
					invoice: invoice.id,
					quantity: input.quantity,
					price_data: {
						currency: BOOKING_INVOICE_CURRENCY.toLowerCase(),
						product: productId,
						unit_amount: unitAmount
					},
					description: `${remotePodcastLabel} (package adjustment)`
				},
				{
					idempotencyKey: packageAdjustmentInvoiceIdempotencyKey(input.adjustmentId, "item")
				}
			);

			const finalizedInvoice = await stripe.invoices.finalizeInvoice(invoice.id, undefined, {
				idempotencyKey: packageAdjustmentInvoiceIdempotencyKey(input.adjustmentId, "finalize")
			});

			await stripe.invoices.sendInvoice(finalizedInvoice.id, undefined, {
				idempotencyKey: packageAdjustmentInvoiceIdempotencyKey(input.adjustmentId, "send")
			});

			return finalizedInvoice.id;
		},
		catch: () => ({ reason: "STRIPE_ADJUSTMENT_INVOICE_FAILED" as const })
	}).map((stripeInvoiceId) => ({ stripeInvoiceId }));
}
