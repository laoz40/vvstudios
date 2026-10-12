import { ok, safeTry } from "neverthrow";
import type { Id } from "#convex/_generated/dataModel";
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
	return safeTry(async function* () {
		const packageId = yield* normalizePackageId(ctx, args.packageId);
		const packageRecord = yield* getPackageFromDb(ctx, packageId);

		const claimedPackage = yield* validatePackageClaimStripeSession(
			packageRecord,
			args.stripeSessionId
		);

		const claimStatus = yield* getPackageCheckoutClaimStatus(claimedPackage);

		const claim = yield* writePackageCheckoutClaimIfPending(ctx, args, claimedPackage, claimStatus);

		return ok(claim);
	});
}

export function abandonPendingPackageCheckout(
	ctx: MutationCtx,
	args: { packageId: Id<"packages">; stripeSessionId: string }
) {
	return safeTry(async function* () {
		const packageRecord = yield* getPackageFromDb(ctx, args.packageId);

		const validAbandonment = yield* validatePendingPackageAbandonment(
			packageRecord,
			args.stripeSessionId
		);

		const outcome = yield* abandonPackageAfterValidate(ctx, args.packageId, validAbandonment);

		return ok(outcome);
	}).orElse(mapPackageNotFoundToAbandonOutcome);
}

export function expirePendingPackageByStripeSessionId(ctx: MutationCtx, stripeSessionId: string) {
	return safeTry(async function* () {
		const packageLookup = yield* lookupPackageByStripeSessionId(ctx, stripeSessionId);
		const expiredPackage = yield* validatePackageExpiry(packageLookup);
		const result = yield* expirePackageAfterValidate(ctx, expiredPackage);

		return ok(result);
	});
}

export function loadPackageRowByStripeSessionId(ctx: QueryCtx, stripeSessionId: string) {
	return lookupPackageByStripeSessionId(ctx, stripeSessionId);
}

export function loadPublicPackageStatusByStripeSessionId(ctx: QueryCtx, stripeSessionId: string) {
	return safeTry(async function* () {
		const packageRow = yield* loadPackageRowByStripeSessionId(ctx, stripeSessionId);

		return ok(buildPublicPackageStatusResponseIfPresent(packageRow));
	});
}
