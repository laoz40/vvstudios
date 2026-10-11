"use node";

import { errAsync, ok, okAsync, type ResultAsync } from "neverthrow";
import type { Result as ConvexResult } from "#/lib/result";
import type { Id } from "#convex/_generated/dataModel";
import { internal } from "#convex/_generated/api";
import type { ActionCtx } from "#convex/_generated/server";
import { fromConvexTuple } from "#convex/shared/lib/result";
import type { PackageAdjustmentInvoiceInput } from "#studio/features/booking-invoice/lib/booking-artifacts";
import { getCustomerAddonDisplayLabel } from "#/domain/booking/catalog";
import { BOOKING_INVOICE_CURRENCY } from "#/domain/booking/price-constants";
import { REMOTE_PODCAST_ADJUSTMENT_RATE } from "#convex/packages/lib/adjustments";
import { PACKAGE_ADJUSTMENT_STRIPE_INVOICE_DAYS_UNTIL_DUE } from "#convex/stripe/lib/adjustmentInvoice";
import { createPackageAdjustmentStripeProduct } from "#convex/stripe/lib/adjustmentInvoice";
import type { StripeClient } from "#convex/stripe/lib/client";

type PackageAdjustmentClaimError =
	| { reason: "PACKAGE_ADJUSTMENT_NOT_FOUND" }
	| { reason: "PACKAGE_ADJUSTMENT_EMAIL_NOT_SENDABLE" }
	| { reason: "PACKAGE_NOT_FOUND" };

export const PACKAGE_ADJUSTMENT_PRODUCT_METADATA_KIND = "package_adjustment_remote_podcast";

export function packageAdjustmentProductQuery() {
	return {
		query: `metadata['kind']:'${PACKAGE_ADJUSTMENT_PRODUCT_METADATA_KIND}' AND active:'true'`,
		limit: 1 as const
	};
}

export function buildPackageAdjustmentProductArgs() {
	return {
		name: getCustomerAddonDisplayLabel("Remote Podcast"),
		metadata: { kind: PACKAGE_ADJUSTMENT_PRODUCT_METADATA_KIND }
	};
}

export function resolvePackageAdjustmentStripeProduct(
	stripe: StripeClient,
	productId: string | undefined
) {
	return productId === undefined
		? createPackageAdjustmentStripeProduct(stripe, buildPackageAdjustmentProductArgs())
		: ok(productId);
}

export function requirePackageAdjustmentStripeCustomer(
	stripeCustomerId: string | undefined
): ResultAsync<string, { reason: "STRIPE_CUSTOMER_NOT_FOUND" }> {
	return stripeCustomerId
		? okAsync(stripeCustomerId)
		: errAsync({ reason: "STRIPE_CUSTOMER_NOT_FOUND" as const });
}

export function buildPackageAdjustmentStripeInvoiceArgs(
	stripeCustomerId: string,
	adjustmentId: Id<"packageAdjustments">,
	packageId: Id<"packages">
) {
	return {
		customer: stripeCustomerId,
		collection_method: "send_invoice" as const,
		days_until_due: PACKAGE_ADJUSTMENT_STRIPE_INVOICE_DAYS_UNTIL_DUE,
		metadata: { adjustmentId, packageId }
	};
}

export function buildPackageAdjustmentInvoiceItemArgs(
	stripeCustomerId: string,
	stripeInvoiceId: string,
	quantity: number,
	productId: string
) {
	return {
		customer: stripeCustomerId,
		invoice: stripeInvoiceId,
		quantity,
		price_data: {
			currency: BOOKING_INVOICE_CURRENCY.toLowerCase(),
			product: productId,
			unit_amount: Math.round(REMOTE_PODCAST_ADJUSTMENT_RATE * 100)
		},
		description: `${getCustomerAddonDisplayLabel("Remote Podcast")} (package adjustment)`
	};
}

export function recordSentPackageAdjustmentInvoice(
	ctx: ActionCtx,
	args: { adjustmentId: Id<"packageAdjustments">; attempt: "automatic" | "retry" },
	claimedAt: number,
	stripeInvoiceId: string
) {
	return fromConvexTuple<
		Promise<ConvexResult<{ updated: boolean }, { reason: "PACKAGE_ADJUSTMENT_NOT_FOUND" }>>
	>(
		ctx.runMutation(internal.packages.adjustments.markPackageAdjustmentInvoiceEmailSent, {
			adjustmentId: args.adjustmentId,
			claimedAt,
			stripeInvoiceId
		})
	);
}

export function recordFailedPackageAdjustmentInvoice(
	ctx: ActionCtx,
	args: { adjustmentId: Id<"packageAdjustments">; claimedAt: number }
) {
	return fromConvexTuple<Promise<ConvexResult<{ updated: boolean }, { reason: string }>>>(
		ctx.runMutation(internal.packages.adjustments.markPackageAdjustmentInvoiceEmailFailed, {
			adjustmentId: args.adjustmentId,
			claimedAt: args.claimedAt
		})
	);
}

export function claimPackageAdjustmentInvoiceEmailForSend(
	ctx: ActionCtx,
	args: { adjustmentId: Id<"packageAdjustments">; attempt: "automatic" | "retry" },
	claimedAt: number
) {
	return fromConvexTuple<
		Promise<ConvexResult<PackageAdjustmentInvoiceInput, PackageAdjustmentClaimError>>
	>(
		ctx.runMutation(internal.packages.adjustments.claimPackageAdjustmentInvoiceEmail, {
			adjustmentId: args.adjustmentId,
			attempt: args.attempt,
			now: claimedAt
		})
	);
}
