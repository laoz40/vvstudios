"use node";

import { type ResultAsync, ok, safeTry } from "neverthrow";
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

export function parsePackageCheckoutRequest(args: CreatePackageRequestArgs) {
	return parsePackageRequest(args);
}

export function runPackageCheckoutSubmitRateLimit(
	ctx: ActionCtx,
	packageRequest: ParsedPackageRequest
): ResultAsync<ParsedPackageRequest, CreatePackageCheckoutSessionError> {
	return safeTry(async function* () {
		yield* checkPackageSubmitRateLimit(ctx, packageRequest.email);

		return ok(packageRequest);
	});
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
	return safeTry(async function* () {
		const coupon = yield* createStripeCheckoutDiscountCoupon(stripe, draft.discount);

		const checkoutSession = yield* createEmbeddedStripePackageCheckoutSession(stripe, {
			...draft,
			couponId: coupon.couponId
		});

		return ok(checkoutSession);
	});
}

function createPendingPackageForCheckout(ctx: ActionCtx, validRequest: ParsedPackageRequest) {
	return safeTry(async function* () {
		const packageRecord = yield* createPendingPackage(ctx, validRequest);
		const checkoutDraft = yield* buildPendingPackageCheckoutDraft(packageRecord);

		return ok(checkoutDraft);
	});
}

export function createPendingPackageForStripeCheckout(
	ctx: ActionCtx,
	validRequest: ParsedPackageRequest
) {
	return safeTry(async function* () {
		yield* requireBookingEmailDomain(validRequest.email);
		const checkoutDraft = yield* createPendingPackageForCheckout(ctx, validRequest);

		return ok(checkoutDraft);
	});
}

export function openEmbeddedPackageStripeCheckout(
	ctx: ActionCtx,
	checkoutDraft: PendingPackageCheckoutDraft
) {
	const stripe = getStripeClient();

	return safeTry(async function* () {
		const checkoutCustomer = yield* createStripeCheckoutCustomer(
			stripe,
			checkoutDraft.packageFromDb,
			{
				packageId: checkoutDraft.packageFromDb._id,
				lineItems: checkoutDraft.checkoutLineItems.lineItems,
				discount: checkoutDraft.checkoutLineItems.discount
			}
		);

		const checkoutSession = yield* createPackageCheckoutSessionWithCoupon(stripe, checkoutCustomer);
		const linkedSession = yield* linkStripeCheckoutToPendingPackage(ctx, checkoutSession);

		return ok(linkedSession);
	});
}

export function closeAbandonedPackageStripeCheckout(
	ctx: ActionCtx,
	args: { packageId: Id<"packages">; stripeSessionId: string }
) {
	const stripe = getStripeClient();

	return safeTry(async function* () {
		const closedSession = yield* closeOpenStripeCheckoutSession(stripe, args);

		const result = yield* resolveClosedPackageCheckoutSession(ctx, args, closedSession);

		return ok(result);
	});
}

export type CreatePackageRequestArgs = LibCreatePackageRequestArgs;
