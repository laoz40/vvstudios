"use node";

import { okAsync, type ResultAsync } from "neverthrow";
import type Stripe from "stripe";
import { internal } from "#convex/_generated/api";
import type { Id } from "#convex/_generated/dataModel";
import type { ActionCtx } from "#convex/_generated/server";
import { checkPackageSubmitRateLimit } from "#convex/booking/services/submission";
import { createPendingPackage } from "#convex/packages/lib/payment";
import {
	parsePackageRequest,
	type CreatePackageRequestArgs as LibCreatePackageRequestArgs,
	type ParsedPackageRequest
} from "#convex/packages/lib/updates";
import { fromConvexTuple } from "#convex/shared/lib/result";
import { getStripeClient } from "#convex/stripe/lib/client";
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
} from "#convex/stripe/lib/checkoutSession";

export type CreatePackageCheckoutSessionError =
	| { reason: "BOOKING_EMAIL_DOMAIN_INVALID" }
	| { reason: "BOOKING_INVALID_DURATION" }
	| { reason: "BOOKING_INVALID_INPUT" }
	| { reason: "BOOKING_RATE_LIMITED"; retryAfter?: number }
	| { reason: "STRIPE_CHECKOUT_CREATE_FAILED" };

export type CloseEmbeddedPackageCheckoutSessionError =
	| { reason: "PACKAGE_NOT_FOUND" }
	| { reason: "STRIPE_CHECKOUT_CLOSE_FAILED" }
	| { reason: "STRIPE_SESSION_MISMATCH" };

type CloseEmbeddedPackageCheckoutSessionSuccess = {
	outcome: "already_complete" | "abandoned" | "not_found" | "not_pending";
};

function keepParsedPackageRequest(packageRequest: ParsedPackageRequest) {
	return packageRequest;
}

export function parsePackageCheckoutRequest(args: CreatePackageRequestArgs) {
	return parsePackageRequest(args);
}

export function runPackageCheckoutSubmitRateLimit(
	ctx: ActionCtx,
	packageRequest: ParsedPackageRequest
): ResultAsync<ParsedPackageRequest, CreatePackageCheckoutSessionError> {
	return checkPackageSubmitRateLimit(ctx, packageRequest.email).map(() =>
		keepParsedPackageRequest(packageRequest)
	);
}

type PendingPackageCheckoutDraft = {
	packageFromDb: PackageInvoiceInput & { _id: Id<"packages"> };
	checkoutLineItems: PackageCheckoutLineItems;
};

function attachCheckoutLineItems(
	packageFromDb: PackageInvoiceInput & { _id: Id<"packages"> },
	checkoutLineItems: PackageCheckoutLineItems
) {
	return { packageFromDb, checkoutLineItems };
}

function buildPendingPackageCheckoutDraft(
	packageFromDb: PackageInvoiceInput & { _id: Id<"packages"> }
) {
	return buildPackageCheckoutLineItems(packageFromDb).map(
		(checkoutLineItems: PackageCheckoutLineItems) =>
			attachCheckoutLineItems(packageFromDb, checkoutLineItems)
	);
}

function createPendingPackageForCheckout(ctx: ActionCtx, validRequest: ParsedPackageRequest) {
	return createPendingPackage(ctx, validRequest).andThen(buildPendingPackageCheckoutDraft);
}

export function createPendingPackageForStripeCheckout(
	ctx: ActionCtx,
	validRequest: ParsedPackageRequest
): ResultAsync<PendingPackageCheckoutDraft, CreatePackageCheckoutSessionError> {
	return requireValidBookingEmailDomain(validRequest.email).andThen(() =>
		createPendingPackageForCheckout(ctx, validRequest)
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

function mapAbandonPackageOutcome(outcome: CloseEmbeddedPackageCheckoutSessionSuccess["outcome"]) {
	return { outcome };
}

function mapAbandonCheckoutMutationError(error: {
	reason: string;
}): CloseEmbeddedPackageCheckoutSessionError {
	if (error.reason === "PACKAGE_NOT_FOUND" || error.reason === "STRIPE_SESSION_MISMATCH") {
		return { reason: error.reason };
	}

	return { reason: "STRIPE_CHECKOUT_CLOSE_FAILED" };
}

function abandonPackageCheckoutAfterClose(
	ctx: ActionCtx,
	args: { packageId: Id<"packages">; stripeSessionId: string }
): ResultAsync<
	CloseEmbeddedPackageCheckoutSessionSuccess,
	CloseEmbeddedPackageCheckoutSessionError
> {
	return fromConvexTuple(ctx.runMutation(internal.packages.checkout.abandonPendingPackage, args))
		.map(mapAbandonPackageOutcomeFromMutation)
		.mapErr(mapAbandonCheckoutMutationError);
}

function mapAbandonPackageOutcomeFromMutation(result: {
	outcome: CloseEmbeddedPackageCheckoutSessionSuccess["outcome"];
}) {
	return mapAbandonPackageOutcome(result.outcome);
}

function resolveClosedPackageCheckoutSession(
	ctx: ActionCtx,
	args: { packageId: Id<"packages">; stripeSessionId: string },

	session: Stripe.Checkout.Session
) {
	if (session.status === "complete") {
		return okAsync({ outcome: "already_complete" as const });
	}

	return abandonPackageCheckoutAfterClose(ctx, args);
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
	}).andThen((session: Stripe.Checkout.Session) =>
		resolveClosedPackageCheckoutSession(ctx, args, session)
	);
}

export type CreatePackageRequestArgs = LibCreatePackageRequestArgs;
