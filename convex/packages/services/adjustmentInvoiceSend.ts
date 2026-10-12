"use node";

import { err, okAsync, ok, safeTry } from "neverthrow";
import type { Id } from "#convex/_generated/dataModel";
import type { ActionCtx } from "#convex/_generated/server";
import type { PackageAdjustmentInvoiceInput } from "#studio/features/booking-invoice/lib/booking-artifacts";
import {
	buildPackageAdjustmentInvoiceItemArgs,
	buildPackageAdjustmentStripeInvoiceArgs,
	packageAdjustmentProductQuery,
	resolvePackageAdjustmentStripeProduct,
	claimPackageAdjustmentInvoiceEmailForSend as claimPackageAdjustmentInvoiceEmailForSendStep,
	recordFailedPackageAdjustmentInvoice as recordFailedPackageAdjustmentInvoiceStep,
	recordSentPackageAdjustmentInvoice as recordSentPackageAdjustmentInvoiceStep,
	requirePackageAdjustmentStripeCustomer
} from "#convex/packages/lib/adjustmentInvoiceSend";
import {
	createPackageAdjustmentStripeInvoice,
	createPackageAdjustmentStripeInvoiceItem,
	finalizePackageAdjustmentStripeInvoice,
	findPackageAdjustmentStripeProduct,
	sendPackageAdjustmentStripeInvoice
} from "#convex/stripe/lib/adjustmentInvoice";
import type { StripeApiFailure } from "#convex/stripe/lib/apiErrors";
import { getStripeClient, type StripeClient } from "#convex/stripe/lib/client";

export type SendPackageAdjustmentInvoiceArgs = {
	adjustmentId: Id<"packageAdjustments">;
	attempt: "automatic" | "retry";
};

type PackageAdjustmentClaimError =
	| { reason: "PACKAGE_ADJUSTMENT_NOT_FOUND" }
	| { reason: "PACKAGE_ADJUSTMENT_EMAIL_NOT_SENDABLE" }
	| { reason: "PACKAGE_NOT_FOUND" };

export type SendPackageAdjustmentInvoiceError = PackageAdjustmentClaimError | StripeApiFailure;

function addRemotePodcastInvoiceItem(
	stripe: StripeClient,
	args: { adjustmentId: Id<"packageAdjustments">; stripeCustomerId: string; quantity: number },
	stripeInvoiceId: string
) {
	return safeTry(async function* () {
		const productLookup = yield* findPackageAdjustmentStripeProduct(
			stripe,
			packageAdjustmentProductQuery()
		);

		const productId = yield* resolvePackageAdjustmentStripeProduct(stripe, productLookup);
		yield* createPackageAdjustmentStripeInvoiceItem(
			stripe,
			args.adjustmentId,
			buildPackageAdjustmentInvoiceItemArgs(
				args.stripeCustomerId,
				stripeInvoiceId,
				args.quantity,
				productId
			)
		);

		return ok({ stripeInvoiceId });
	});
}

export function createPackageAdjustmentInvoiceDraft(
	adjustmentId: Id<"packageAdjustments">,
	input: PackageAdjustmentInvoiceInput
) {
	const stripe = getStripeClient();

	return safeTry(async function* () {
		const stripeCustomerId = yield* requirePackageAdjustmentStripeCustomer(
			input.packageRecord.stripeCustomerId
		);

		const invoiceDraft = yield* createPackageAdjustmentStripeInvoiceDraft(
			stripe,
			adjustmentId,
			input,
			stripeCustomerId
		);

		return ok(invoiceDraft);
	});
}

function createPackageAdjustmentStripeInvoiceDraft(
	stripe: StripeClient,
	adjustmentId: Id<"packageAdjustments">,
	{ adjustment, packageRecord }: PackageAdjustmentInvoiceInput,
	stripeCustomerId: string
) {
	return safeTry(async function* () {
		const stripeInvoiceId = yield* createPackageAdjustmentStripeInvoice(
			stripe,
			adjustmentId,
			buildPackageAdjustmentStripeInvoiceArgs(stripeCustomerId, adjustmentId, packageRecord._id)
		);

		const invoiceItem = yield* addRemotePodcastInvoiceItem(
			stripe,
			{ adjustmentId, stripeCustomerId, quantity: adjustment.quantity },
			stripeInvoiceId
		);

		return ok(invoiceItem);
	});
}

export function sendPackageAdjustmentInvoiceDraft(
	adjustmentId: Id<"packageAdjustments">,
	{ stripeInvoiceId }: { stripeInvoiceId: string }
) {
	const stripe = getStripeClient();

	return safeTry(async function* () {
		const finalizedInvoiceId = yield* finalizePackageAdjustmentStripeInvoice(
			stripe,
			adjustmentId,
			stripeInvoiceId
		);

		const sentInvoice = yield* sendFinalizedPackageAdjustmentInvoice(
			stripe,
			adjustmentId,
			finalizedInvoiceId
		);

		return ok(sentInvoice);
	});
}

function sendFinalizedPackageAdjustmentInvoice(
	stripe: StripeClient,
	adjustmentId: Id<"packageAdjustments">,
	finalizedInvoiceId: string
) {
	return safeTry(async function* () {
		yield* sendPackageAdjustmentStripeInvoice(stripe, adjustmentId, finalizedInvoiceId);

		return ok({ stripeInvoiceId: finalizedInvoiceId });
	});
}

export function recordSentPackageAdjustmentInvoice(
	ctx: ActionCtx,
	args: SendPackageAdjustmentInvoiceArgs,
	claimedAt: number,
	{ stripeInvoiceId }: { stripeInvoiceId: string }
) {
	return safeTry(async function* () {
		yield* recordSentPackageAdjustmentInvoiceStep(ctx, args, claimedAt, stripeInvoiceId);

		return ok(null);
	});
}

export function recordFailedPackageAdjustmentInvoice<T extends StripeApiFailure>(
	ctx: ActionCtx,
	args: { adjustmentId: Id<"packageAdjustments">; claimedAt: number },
	failure: T
) {
	return safeTry(async function* () {
		yield* recordFailedPackageAdjustmentInvoiceStep(ctx, args).orElse(() => okAsync(null));

		return err(failure);
	});
}

export function claimPackageAdjustmentInvoiceEmailForSend(
	ctx: ActionCtx,
	args: SendPackageAdjustmentInvoiceArgs,
	claimedAt: number
) {
	return claimPackageAdjustmentInvoiceEmailForSendStep(ctx, args, claimedAt);
}
