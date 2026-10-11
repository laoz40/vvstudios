import type { Doc, Id } from "#convex/_generated/dataModel";
import type { MutationCtx, QueryCtx } from "#convex/_generated/server";
import {
	abandonPackageAfterValidate,
	buildPublicPackageStatusResponseIfPresent,
	expirePackageAfterValidate,
	mapPackageNotFoundToAbandonOutcome,
	validatePackageExpiry,
	validatePendingPackageAbandonment
} from "#convex/packages/lib/checkout";
import {
	getPackageCheckoutClaimStatus,
	writePackageCheckoutClaimIfPending,
	validatePackageClaimStripeSession
} from "#convex/packages/lib/checkoutClaim";
import { lookupPackageByStripeSessionId, normalizePackageId } from "#convex/packages/lib/lookup";
import { getPackageFromDb } from "#convex/packages/services/lookup";
import { patchPackageStripeCheckoutIds } from "#convex/packages/lib/updates";

type ClaimPackageCheckoutPaymentArgs = {
	packageId: string;
	stripeSessionId: string;
	stripePaymentIntentId?: string;
	originalPaidAmount?: number;
};

export function writePackageStripeCheckoutIds(
	ctx: MutationCtx,
	args: { packageId: Id<"packages">; stripeSessionId: string; stripeCustomerId: string }
) {
	return patchPackageStripeCheckoutIds(ctx, args);
}

export function claimPackageCheckoutPayment(
	ctx: MutationCtx,
	args: ClaimPackageCheckoutPaymentArgs
) {
	return normalizePackageId(ctx, args.packageId)
		.asyncAndThen((normalizedPackageId: Id<"packages">) =>
			getPackageFromDb(ctx, normalizedPackageId)
		)
		.andThen((packageFromDb: Doc<"packages">) =>
			validatePackageClaimStripeSession(packageFromDb, args.stripeSessionId)
		)
		.andThen((packageFromDb: Doc<"packages">) =>
			getPackageCheckoutClaimStatus(packageFromDb).map((claimStatus) => ({
				claimStatus,
				packageFromDb
			}))
		)
		.andThen(({ claimStatus, packageFromDb }) =>
			writePackageCheckoutClaimIfPending(ctx, args, packageFromDb, claimStatus)
		);
}

export function abandonPendingPackageCheckout(
	ctx: MutationCtx,
	args: { packageId: Id<"packages">; stripeSessionId: string }
) {
	return getPackageFromDb(ctx, args.packageId)
		.andThen((packageFromDb: Doc<"packages">) =>
			validatePendingPackageAbandonment(packageFromDb, args.stripeSessionId)
		)
		.andThen((decision) => abandonPackageAfterValidate(ctx, args.packageId, decision))
		.orElse(mapPackageNotFoundToAbandonOutcome);
}

export function expirePendingPackageByStripeSessionId(ctx: MutationCtx, stripeSessionId: string) {
	return lookupPackageByStripeSessionId(ctx, stripeSessionId)
		.andThen(validatePackageExpiry)
		.andThen((decision) => expirePackageAfterValidate(ctx, decision));
}

export function loadPackageRowByStripeSessionId(ctx: QueryCtx, stripeSessionId: string) {
	return lookupPackageByStripeSessionId(ctx, stripeSessionId);
}

export function loadPublicPackageStatusByStripeSessionId(ctx: QueryCtx, stripeSessionId: string) {
	return loadPackageRowByStripeSessionId(ctx, stripeSessionId).map(
		buildPublicPackageStatusResponseIfPresent
	);
}
