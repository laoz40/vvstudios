import { err, errAsync, ok, type ResultAsync } from "neverthrow";
import type { Result as ConvexResult } from "#/lib/result";
import { internal } from "#convex/_generated/api";
import type { Id } from "#convex/_generated/dataModel";
import type { ActionCtx } from "#convex/_generated/server";
import type { PackageAdjustmentInvoiceInput } from "#studio/features/booking-invoice/lib/booking-artifacts";
import { REMOTE_PODCAST_ADJUSTMENT_RATE } from "#convex/lib/packages/packageAdjustments";
import { fromConvexTuple } from "#convex/lib/result";
import {
	createPackageAdjustmentStripeInvoice,
	createPackageAdjustmentStripeInvoiceItem,
	createPackageAdjustmentStripeProduct,
	finalizePackageAdjustmentStripeInvoice,
	findPackageAdjustmentStripeProduct,
	PACKAGE_ADJUSTMENT_STRIPE_INVOICE_DAYS_UNTIL_DUE,
	sendPackageAdjustmentStripeInvoice
} from "#convex/lib/stripe/stripeAdjustmentInvoice";
import type { StripeApiFailure } from "#convex/lib/stripe/stripeApiErrors";
import { getStripeClient, type StripeClient } from "#convex/lib/stripe/stripeClient";
import { getCustomerAddonDisplayLabel } from "#studio/features/booking-form/lib/booking-form-model";
import { BOOKING_INVOICE_CURRENCY } from "#studio/features/booking-form/lib/booking-pricing";

export type SendPackageAdjustmentInvoiceArgs = {
	adjustmentId: Id<"packageAdjustments">;
	attempt: "automatic" | "retry";
};

type PackageAdjustmentClaimError =
	| { reason: "PACKAGE_ADJUSTMENT_NOT_FOUND" }
	| { reason: "PACKAGE_ADJUSTMENT_EMAIL_NOT_SENDABLE" }
	| { reason: "PACKAGE_NOT_FOUND" };

export type SendPackageAdjustmentInvoiceError = PackageAdjustmentClaimError | StripeApiFailure;

const PACKAGE_ADJUSTMENT_PRODUCT_METADATA_KIND = "package_adjustment_remote_podcast";

function createMissingRemotePodcastProduct(stripe: StripeClient, productId: string | undefined) {
	return productId !== undefined
		? ok(productId)
		: createPackageAdjustmentStripeProduct(stripe, {
				name: getCustomerAddonDisplayLabel("Remote Podcast"),
				metadata: { kind: PACKAGE_ADJUSTMENT_PRODUCT_METADATA_KIND }
			});
}

function addRemotePodcastInvoiceItem(
	stripe: StripeClient,
	args: { adjustmentId: Id<"packageAdjustments">; stripeCustomerId: string; quantity: number },
	stripeInvoiceId: string
) {
	return findPackageAdjustmentStripeProduct(stripe, {
		query: `metadata['kind']:'${PACKAGE_ADJUSTMENT_PRODUCT_METADATA_KIND}' AND active:'true'`,
		limit: 1
	})
		.andThen((productId) => createMissingRemotePodcastProduct(stripe, productId))
		.andThen((productId) =>
			createPackageAdjustmentStripeInvoiceItem(stripe, args.adjustmentId, {
				customer: args.stripeCustomerId,
				invoice: stripeInvoiceId,
				quantity: args.quantity,
				price_data: {
					currency: BOOKING_INVOICE_CURRENCY.toLowerCase(),
					product: productId,
					unit_amount: Math.round(REMOTE_PODCAST_ADJUSTMENT_RATE * 100)
				},
				description: `${getCustomerAddonDisplayLabel("Remote Podcast")} (package adjustment)`
			})
		)
		.map(() => ({ stripeInvoiceId }));
}

export function createPackageAdjustmentInvoiceDraft(
	adjustmentId: Id<"packageAdjustments">,
	{ adjustment, packageRecord }: PackageAdjustmentInvoiceInput
): ResultAsync<{ stripeInvoiceId: string }, StripeApiFailure> {
	const stripe = getStripeClient();
	const stripeCustomerId = packageRecord.stripeCustomerId;

	if (!stripeCustomerId) {
		return errAsync({ reason: "STRIPE_CUSTOMER_NOT_FOUND" });
	}

	return createPackageAdjustmentStripeInvoice(stripe, adjustmentId, {
		customer: stripeCustomerId,
		collection_method: "send_invoice",
		days_until_due: PACKAGE_ADJUSTMENT_STRIPE_INVOICE_DAYS_UNTIL_DUE,
		metadata: { adjustmentId, packageId: packageRecord._id }
	}).andThen((stripeInvoiceId) =>
		addRemotePodcastInvoiceItem(
			stripe,
			{ adjustmentId, stripeCustomerId, quantity: adjustment.quantity },
			stripeInvoiceId
		)
	);
}

export function sendPackageAdjustmentInvoiceDraft(
	adjustmentId: Id<"packageAdjustments">,
	{ stripeInvoiceId }: { stripeInvoiceId: string }
): ResultAsync<{ stripeInvoiceId: string }, StripeApiFailure> {
	const stripe = getStripeClient();

	return finalizePackageAdjustmentStripeInvoice(stripe, adjustmentId, stripeInvoiceId).andThen(
		(finalizedInvoiceId) =>
			sendPackageAdjustmentStripeInvoice(stripe, adjustmentId, finalizedInvoiceId).map(() => ({
				stripeInvoiceId: finalizedInvoiceId
			}))
	);
}

export function recordSentPackageAdjustmentInvoice(
	ctx: ActionCtx,
	args: SendPackageAdjustmentInvoiceArgs,
	claimedAt: number,
	{ stripeInvoiceId }: { stripeInvoiceId: string }
) {
	return fromConvexTuple<
		Promise<ConvexResult<{ updated: boolean }, { reason: "PACKAGE_ADJUSTMENT_NOT_FOUND" }>>
	>(
		ctx.runMutation(internal.packageAdjustments.markPackageAdjustmentInvoiceEmailSent, {
			adjustmentId: args.adjustmentId,
			claimedAt,
			stripeInvoiceId
		})
	).map(() => null);
}

export function recordFailedPackageAdjustmentInvoice<T extends StripeApiFailure>(
	ctx: ActionCtx,
	args: { adjustmentId: Id<"packageAdjustments">; claimedAt: number },
	failure: T
): ResultAsync<never, T> {
	return fromConvexTuple<Promise<ConvexResult<{ updated: boolean }, { reason: string }>>>(
		ctx.runMutation(internal.packageAdjustments.markPackageAdjustmentInvoiceEmailFailed, {
			adjustmentId: args.adjustmentId,
			claimedAt: args.claimedAt
		})
	)
		.orElse(() => ok(null))
		.andThen(() => err(failure));
}

export function claimPackageAdjustmentInvoiceEmailForSend(
	ctx: ActionCtx,
	args: SendPackageAdjustmentInvoiceArgs,
	claimedAt: number
): ResultAsync<PackageAdjustmentInvoiceInput, PackageAdjustmentClaimError> {
	return fromConvexTuple<
		Promise<ConvexResult<PackageAdjustmentInvoiceInput, PackageAdjustmentClaimError>>
	>(
		ctx.runMutation(internal.packageAdjustments.claimPackageAdjustmentInvoiceEmail, {
			adjustmentId: args.adjustmentId,
			attempt: args.attempt,
			now: claimedAt
		})
	);
}
