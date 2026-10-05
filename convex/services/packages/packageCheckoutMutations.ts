import { errAsync, ok, okAsync } from "neverthrow";
import type { Id } from "#convex/_generated/dataModel";
import type { MutationCtx, QueryCtx } from "#convex/_generated/server";
import { archiveDeadPackage } from "#convex/lib/packages/packageArchive";
import {
	buildPublicPackageStatusResponse,
	validatePackageExpiry,
	validatePendingPackageAbandonment,
	type AbandonPendingPackageSuccess
} from "#convex/lib/packages/packageCheckout";
import {
	getPackageCheckoutClaimStatus,
	validatePackageClaimStripeSession
} from "#convex/lib/packages/packageCheckoutClaim";
import {
	getPackageFromDb,
	lookupPackageByStripeSessionId,
	normalizePackageId
} from "#convex/lib/packages/packageLookup";
import {
	patchPackageCheckoutClaimed,
	patchPackageStripeCheckoutIds
} from "#convex/lib/packages/packageUpdates";

export function writePackageStripeCheckoutIds(
	ctx: MutationCtx,
	args: { packageId: Id<"packages">; stripeSessionId: string; stripeCustomerId: string }
) {
	return patchPackageStripeCheckoutIds(ctx, args);
}

export function claimPackageCheckoutPayment(
	ctx: MutationCtx,
	args: { packageId: string; stripeSessionId: string; stripePaymentIntentId?: string }
) {
	return normalizePackageId(ctx, args.packageId)
		.asyncAndThen((normalizedPackageId) => getPackageFromDb(ctx, normalizedPackageId))
		.andThen((packageFromDb) =>
			validatePackageClaimStripeSession(packageFromDb, args.stripeSessionId).map(
				() => packageFromDb
			)
		)
		.andThen((packageFromDb) =>
			getPackageCheckoutClaimStatus(packageFromDb).map((claimStatus) => ({
				claimStatus,
				packageFromDb
			}))
		)
		.andThen(({ claimStatus, packageFromDb }) => {
			const packageId = packageFromDb._id;

			if (claimStatus.kind === "already_completed") {
				return okAsync({ outcome: "already_completed" as const, packageId });
			}

			if (claimStatus.kind === "already_claimed") {
				return okAsync({ outcome: "already_claimed" as const, packageId });
			}

			const now = Date.now();

			return patchPackageCheckoutClaimed(ctx, packageFromDb._id, {
				packageCheckoutClaimedAt: now,
				stripePaymentIntentId: args.stripePaymentIntentId
			}).map(() => ({ outcome: "claimed" as const, packageId }));
		});
}

export function abandonPendingPackageCheckout(
	ctx: MutationCtx,
	args: { packageId: Id<"packages">; stripeSessionId: string }
) {
	return getPackageFromDb(ctx, args.packageId)
		.andThen((packageFromDb) =>
			validatePendingPackageAbandonment(packageFromDb, args.stripeSessionId)
		)
		.andThen((abandonDecision) => {
			if (abandonDecision.kind === "complete") {
				return ok(abandonDecision.value);
			}

			return archiveDeadPackage(ctx, args.packageId, { status: "abandoned" }).map(
				(): AbandonPendingPackageSuccess => ({ outcome: "abandoned" })
			);
		})
		.orElse((error) =>
			error.reason === "PACKAGE_NOT_FOUND" ? ok({ outcome: "not_found" as const }) : errAsync(error)
		);
}

export function expirePendingPackageByStripeSessionId(ctx: MutationCtx, stripeSessionId: string) {
	return lookupPackageByStripeSessionId(ctx, stripeSessionId)
		.andThen(validatePackageExpiry)
		.andThen((expireDecision) => {
			if (expireDecision.kind === "complete") {
				return ok({ alreadyExpired: expireDecision.alreadyExpired });
			}

			return archiveDeadPackage(ctx, expireDecision.packageId, { status: "expired" }).map(() => ({
				alreadyExpired: false
			}));
		});
}

export function loadPackageRowByStripeSessionId(ctx: QueryCtx, stripeSessionId: string) {
	return lookupPackageByStripeSessionId(ctx, stripeSessionId);
}

export function loadPublicPackageStatusByStripeSessionId(ctx: QueryCtx, stripeSessionId: string) {
	return loadPackageRowByStripeSessionId(ctx, stripeSessionId).map((packageFromDb) =>
		packageFromDb === null ? null : buildPublicPackageStatusResponse(packageFromDb)
	);
}
