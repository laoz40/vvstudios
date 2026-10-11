"use node";

import { errAsync, okAsync, type ResultAsync } from "neverthrow";
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
	return findPackageAdjustmentStripeProduct(stripe, packageAdjustmentProductQuery())
		.andThen((productId) => resolvePackageAdjustmentStripeProduct(stripe, productId))
		.andThen((productId) =>
			createPackageAdjustmentStripeInvoiceItem(
				stripe,
				args.adjustmentId,
				buildPackageAdjustmentInvoiceItemArgs(
					args.stripeCustomerId,
					stripeInvoiceId,
					args.quantity,
					productId
				)
			)
		)
		.map(() => ({ stripeInvoiceId }));
}

export function createPackageAdjustmentInvoiceDraft(
	adjustmentId: Id<"packageAdjustments">,
	input: PackageAdjustmentInvoiceInput
): ResultAsync<{ stripeInvoiceId: string }, StripeApiFailure> {
	const stripe = getStripeClient();

	return requirePackageAdjustmentStripeCustomer(input.packageRecord.stripeCustomerId).andThen(
		(stripeCustomerId) =>
			createPackageAdjustmentStripeInvoiceDraft(stripe, adjustmentId, input, stripeCustomerId)
	);
}

function createPackageAdjustmentStripeInvoiceDraft(
	stripe: StripeClient,
	adjustmentId: Id<"packageAdjustments">,
	{ adjustment, packageRecord }: PackageAdjustmentInvoiceInput,
	stripeCustomerId: string
) {
	return createPackageAdjustmentStripeInvoice(
		stripe,
		adjustmentId,
		buildPackageAdjustmentStripeInvoiceArgs(stripeCustomerId, adjustmentId, packageRecord._id)
	).andThen((stripeInvoiceId) =>
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
			sendFinalizedPackageAdjustmentInvoice(stripe, adjustmentId, finalizedInvoiceId)
	);
}

function sendFinalizedPackageAdjustmentInvoice(
	stripe: StripeClient,
	adjustmentId: Id<"packageAdjustments">,
	finalizedInvoiceId: string
) {
	return sendPackageAdjustmentStripeInvoice(stripe, adjustmentId, finalizedInvoiceId).map(() => ({
		stripeInvoiceId: finalizedInvoiceId
	}));
}

export function recordSentPackageAdjustmentInvoice(
	ctx: ActionCtx,
	args: SendPackageAdjustmentInvoiceArgs,
	claimedAt: number,
	{ stripeInvoiceId }: { stripeInvoiceId: string }
) {
	return recordSentPackageAdjustmentInvoiceStep(ctx, args, claimedAt, stripeInvoiceId).map(
		() => null
	);
}

export function recordFailedPackageAdjustmentInvoice<T extends StripeApiFailure>(
	ctx: ActionCtx,
	args: { adjustmentId: Id<"packageAdjustments">; claimedAt: number },
	failure: T
): ResultAsync<never, T> {
	return recordFailedPackageAdjustmentInvoiceStep(ctx, args)
		.orElse(() => okAsync(null))
		.andThen(() => errAsync(failure));
}

export function claimPackageAdjustmentInvoiceEmailForSend(
	ctx: ActionCtx,
	args: SendPackageAdjustmentInvoiceArgs,
	claimedAt: number
): ResultAsync<PackageAdjustmentInvoiceInput, PackageAdjustmentClaimError> {
	return claimPackageAdjustmentInvoiceEmailForSendStep(ctx, args, claimedAt);
}
