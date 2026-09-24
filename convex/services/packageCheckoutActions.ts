"use node";

import { okAsync, ResultAsync } from "neverthrow";
import { internal } from "#convex/_generated/api";
import type { Id } from "#convex/_generated/dataModel";
import type { ActionCtx } from "#convex/_generated/server";
import { checkPackageSubmitRateLimit } from "#convex/lib/bookingSubmission";
import { createPendingPackage } from "#convex/lib/packagePayment";
import { parsePackageRequest, type CreatePackageRequestArgs } from "#convex/lib/packageUpdates";
import { fromConvexTuple } from "#convex/lib/result";
import { getStripeClient, type StripeClient } from "#convex/lib/stripeClient";
import { buildPackageCheckoutLineItems } from "#convex/lib/stripeCheckoutLineItems";
import {
	closeOpenStripeCheckoutSession,
	createEmbeddedStripePackageCheckoutSession,
	createStripeCheckoutCustomer,
	linkStripeCheckoutToPendingPackage,
	requireValidBookingEmailDomain
} from "#convex/lib/stripeCheckoutSession";

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

export function createPackageCheckoutSessionService(
	ctx: ActionCtx,
	args: CreatePackageRequestArgs,
	stripe: StripeClient = getStripeClient()
): ResultAsync<
	{ packageId: Id<"packages">; clientSecret: string; stripeSessionId: string },
	CreatePackageCheckoutSessionError
> {
	return parsePackageRequest(args)
		.andThen((packageRequest) =>
			checkPackageSubmitRateLimit(ctx, packageRequest.email).map(() => packageRequest)
		)
		.andThen((validRequest) =>
			requireValidBookingEmailDomain(validRequest.email).map(() => validRequest)
		)
		.andThen((validRequest) => createPendingPackage(ctx, validRequest))
		.andThen((packageFromDb) =>
			buildPackageCheckoutLineItems(packageFromDb).map((checkoutLineItems) => ({
				packageFromDb,
				checkoutLineItems
			}))
		)
		.andThen(({ packageFromDb, checkoutLineItems }) =>
			createStripeCheckoutCustomer(stripe, packageFromDb, {
				packageId: packageFromDb._id,
				lineItems: checkoutLineItems.lineItems,
				discount: checkoutLineItems.discount
			})
		)
		.andThen((checkoutDraft) => createEmbeddedStripePackageCheckoutSession(stripe, checkoutDraft))
		.andThen((checkoutDraft) => linkStripeCheckoutToPendingPackage(ctx, checkoutDraft));
}

export function closeEmbeddedPackageCheckoutSessionService(
	ctx: ActionCtx,
	args: { packageId: Id<"packages">; stripeSessionId: string },
	stripe: StripeClient = getStripeClient()
): ResultAsync<
	CloseEmbeddedPackageCheckoutSessionSuccess,
	CloseEmbeddedPackageCheckoutSessionError
> {
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
