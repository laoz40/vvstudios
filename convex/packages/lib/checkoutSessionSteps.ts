"use node";

import { okAsync, type ResultAsync } from "neverthrow";
import type Stripe from "stripe";
import { internal } from "#convex/_generated/api";
import type { Id } from "#convex/_generated/dataModel";
import type { ActionCtx } from "#convex/_generated/server";

import { fromConvexTuple } from "#convex/shared/lib/result";

import type { PackageInvoiceInput } from "#studio/features/booking-invoice/lib/booking-artifacts";
import {
	buildPackageCheckoutLineItems,
	type PackageCheckoutLineItems
} from "#studio/features/booking-invoice/lib/stripe-checkout-line-items";

export type CloseEmbeddedPackageCheckoutSessionError =
	| { reason: "PACKAGE_NOT_FOUND" }
	| { reason: "STRIPE_CHECKOUT_CLOSE_FAILED" }
	| { reason: "STRIPE_SESSION_MISMATCH" };

type CloseEmbeddedPackageCheckoutSessionSuccess = {
	outcome: "already_complete" | "abandoned" | "not_found" | "not_pending";
};

export function buildPendingPackageCheckoutDraft(
	packageFromDb: PackageInvoiceInput & { _id: Id<"packages"> }
) {
	return buildPackageCheckoutLineItems(packageFromDb).map(
		(checkoutLineItems: PackageCheckoutLineItems) => ({ packageFromDb, checkoutLineItems })
	);
}

export function mapAbandonCheckoutMutationError(error: {
	reason: string;
}): CloseEmbeddedPackageCheckoutSessionError {
	if (error.reason === "PACKAGE_NOT_FOUND" || error.reason === "STRIPE_SESSION_MISMATCH") {
		return { reason: error.reason };
	}

	return { reason: "STRIPE_CHECKOUT_CLOSE_FAILED" };
}

export function abandonPackageCheckoutAfterClose(
	ctx: ActionCtx,
	args: { packageId: Id<"packages">; stripeSessionId: string }
): ResultAsync<
	CloseEmbeddedPackageCheckoutSessionSuccess,
	CloseEmbeddedPackageCheckoutSessionError
> {
	return fromConvexTuple(ctx.runMutation(internal.packages.checkout.abandonPendingPackage, args))
		.map(({ outcome }) => ({ outcome }))
		.mapErr(mapAbandonCheckoutMutationError);
}

export function resolveClosedPackageCheckoutSession(
	ctx: ActionCtx,
	args: { packageId: Id<"packages">; stripeSessionId: string },

	session: Stripe.Checkout.Session
) {
	if (session.status === "complete") {
		return okAsync({ outcome: "already_complete" as const });
	}

	return abandonPackageCheckoutAfterClose(ctx, args);
}
