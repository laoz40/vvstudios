"use node";

import { type ResultAsync } from "neverthrow";
import type Stripe from "stripe";

import type { Id } from "#convex/_generated/dataModel";
import type { ActionCtx } from "#convex/_generated/server";
import { checkPackageSubmitRateLimit } from "#convex/booking/services/submission";
import { createPendingPackage } from "#convex/packages/lib/payment";
import {
	parsePackageRequest,
	type CreatePackageRequestArgs as LibCreatePackageRequestArgs,
	type ParsedPackageRequest
} from "#convex/packages/lib/updates";

import { requireBookingEmailDomain } from "#convex/shared/services/bookingEmailDomain";
import { getStripeClient } from "#convex/stripe/lib/client";
import type { PackageInvoiceInput } from "#studio/features/booking-invoice/lib/booking-artifacts";
import { type PackageCheckoutLineItems } from "#studio/features/booking-invoice/lib/stripe-checkout-line-items";
import {
	closeOpenStripeCheckoutSession,
	createEmbeddedStripePackageCheckoutSession,
	createStripeCheckoutDiscountCoupon,
	createStripeCheckoutCustomer,
	linkStripeCheckoutToPendingPackage
} from "#convex/stripe/lib/checkoutSession";
import {
	buildPendingPackageCheckoutDraft,
	resolveClosedPackageCheckoutSession
} from "#convex/packages/lib/checkoutSessionSteps";

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

export function parsePackageCheckoutRequest(args: CreatePackageRequestArgs) {
	return parsePackageRequest(args);
}

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

type PackageCheckoutCustomerDraft = {
	packageId: Id<"packages">;
	lineItems: PackageCheckoutLineItems["lineItems"];
	discount: PackageCheckoutLineItems["discount"];
	stripeCustomerId: string;
};

function createPackageCheckoutSessionWithCoupon(
	stripe: Stripe,
	draft: PackageCheckoutCustomerDraft
) {
	return createStripeCheckoutDiscountCoupon(stripe, draft.discount).andThen(({ couponId }) =>
		createEmbeddedStripePackageCheckoutSession(stripe, { ...draft, couponId })
	);
}

function createPendingPackageForCheckout(ctx: ActionCtx, validRequest: ParsedPackageRequest) {
	return createPendingPackage(ctx, validRequest).andThen(buildPendingPackageCheckoutDraft);
}

export function createPendingPackageForStripeCheckout(
	ctx: ActionCtx,
	validRequest: ParsedPackageRequest
): ResultAsync<PendingPackageCheckoutDraft, CreatePackageCheckoutSessionError> {
	return requireBookingEmailDomain(validRequest.email).andThen(() =>
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
		.andThen((draft) => createPackageCheckoutSessionWithCoupon(stripe, draft))
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
	}).andThen((session: Stripe.Checkout.Session) =>
		resolveClosedPackageCheckoutSession(ctx, args, session)
	);
}

export type CreatePackageRequestArgs = LibCreatePackageRequestArgs;
