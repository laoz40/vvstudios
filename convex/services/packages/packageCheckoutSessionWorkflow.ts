"use node";

import { okAsync, type ResultAsync } from "neverthrow";
import { internal } from "#convex/_generated/api";
import type { Id } from "#convex/_generated/dataModel";
import type { ActionCtx } from "#convex/_generated/server";
import { checkPackageSubmitRateLimit } from "#convex/lib/booking/bookingSubmission";
import { createPendingPackage } from "#convex/lib/packages/packagePayment";
import {
	type CreatePackageRequestArgs,
	type ParsedPackageRequest
} from "#convex/lib/packages/packageUpdates";
import { fromConvexTuple } from "#convex/lib/result";
import { getStripeClient } from "#convex/lib/stripe/stripeClient";
import type { PackageInvoiceInput } from "#studio/features/booking-invoice/lib/booking-artifacts";
import {
	buildPackageCheckoutLineItems,
	type PackageCheckoutLineItems
} from "#studio/features/booking-invoice/lib/stripe-checkout-line-items";
import {
	closeOpenStripeCheckoutSession,
	createEmbeddedStripePackageCheckoutSession,
	createStripeCheckoutCustomer,
	linkStripeCheckoutToPendingPackage,
	requireValidBookingEmailDomain
} from "#convex/lib/stripe/stripeCheckoutSession";

export type CreatePackageCheckoutSessionError =
	| { reason: "BOOKING_EMAIL_DOMAIN_INVALID" }
	| { reason: "BOOKING_INVALID_DURATION" }
	| { reason: "BOOKING_INVALID_INPUT" }
	| { reason: "BOOKING_RATE_LIMITED"; retryAfter?: number }
	| { reason: "STRIPE_CHECKOUT_CREATE_FAILED" };

export type CloseEmbeddedPackageCheckoutSessionError =
	| { reason: "STRIPE_CHECKOUT_CLOSE_FAILED" }
	| { reason: "STRIPE_SESSION_MISMATCH" };

type CloseEmbeddedPackageCheckoutSessionSuccess = {
	outcome: "already_complete" | "abandoned" | "not_found" | "not_pending";
};

export function runPackageCheckoutSubmitRateLimit(
	ctx: ActionCtx,
	packageRequest: ParsedPackageRequest
): ResultAsync<ParsedPackageRequest, CreatePackageCheckoutSessionError> {
	return checkPackageSubmitRateLimit(ctx, packageRequest.email).map(() => packageRequest);
}

type PendingPackageCheckoutDraft = {
	packageFromDb: PackageInvoiceInput & { _id: Id<"packages"> };
	checkoutLineItems: PackageCheckoutLineItems;
};

export function createPendingPackageForStripeCheckout(
	ctx: ActionCtx,
	validRequest: ParsedPackageRequest
): ResultAsync<PendingPackageCheckoutDraft, CreatePackageCheckoutSessionError> {
	return requireValidBookingEmailDomain(validRequest.email)
		.andThen(() => createPendingPackage(ctx, validRequest))
		.andThen((packageFromDb) =>
			buildPackageCheckoutLineItems(packageFromDb).map((checkoutLineItems) => ({
				packageFromDb,
				checkoutLineItems
			}))
		);
}

export function openEmbeddedPackageStripeCheckout(
	ctx: ActionCtx,
	checkoutDraft: PendingPackageCheckoutDraft
): ResultAsync<
	{ packageId: Id<"packages">; clientSecret: string; stripeSessionId: string },
	CreatePackageCheckoutSessionError
> {
	const stripe = getStripeClient();

	return createStripeCheckoutCustomer(stripe, checkoutDraft.packageFromDb, {
		packageId: checkoutDraft.packageFromDb._id,
		lineItems: checkoutDraft.checkoutLineItems.lineItems,
		discount: checkoutDraft.checkoutLineItems.discount
	})
		.andThen((draft) => createEmbeddedStripePackageCheckoutSession(stripe, draft))
		.andThen((draft) => linkStripeCheckoutToPendingPackage(ctx, draft));
}

export function closeAbandonedPackageStripeCheckout(
	ctx: ActionCtx,
	args: { packageId: Id<"packages">; stripeSessionId: string }
): ResultAsync<
	CloseEmbeddedPackageCheckoutSessionSuccess,
	CloseEmbeddedPackageCheckoutSessionError
> {
	const stripe = getStripeClient();

	return closeOpenStripeCheckoutSession(stripe, args.stripeSessionId, {
		packageId: args.packageId,
		stripeSessionId: args.stripeSessionId
	}).andThen((session) => {
		if (session.status === "complete") {
			return okAsync({ outcome: "already_complete" as const });
		}

		return fromConvexTuple(
			ctx.runMutation(internal.packageCheckout.abandonPendingPackage, args)
		).map(({ outcome }) => ({ outcome }));
	});
}

export type { CreatePackageRequestArgs };
