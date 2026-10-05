import { errAsync, ok, okAsync } from "neverthrow";
import type { Doc, Id } from "#convex/_generated/dataModel";
import type { MutationCtx, QueryCtx } from "#convex/_generated/server";
import { archiveDeadPackage } from "#convex/lib/packages/packageArchive";
import {
	buildPublicPackageStatusResponse,
	validatePackageExpiry,
	validatePendingPackageAbandonment,
	type AbandonPendingPackageDecision,
	type AbandonPendingPackageSuccess,
	type ExpirePackageDecision
} from "#convex/lib/packages/packageCheckout";
import {
	getPackageCheckoutClaimStatus,
	type PackageCheckoutClaimStatus,
	validatePackageClaimStripeSession
} from "#convex/lib/packages/packageCheckoutClaim";
import {
	lookupPackageByStripeSessionId,
	normalizePackageId
} from "#convex/lib/packages/packageLookup";
import { getPackageFromDb } from "#convex/services/packages/packageLookup";
import {
	patchPackageCheckoutClaimed,
	patchPackageStripeCheckoutIds
} from "#convex/lib/packages/packageUpdates";

type ClaimPackageCheckoutPaymentArgs = {
	packageId: string;
	stripeSessionId: string;
	stripePaymentIntentId?: string;
};

function loadPackageForNormalizedId(ctx: MutationCtx) {
	return (normalizedPackageId: Id<"packages">) => getPackageFromDb(ctx, normalizedPackageId);
}

function validateClaimStripeSessionForArgs(args: ClaimPackageCheckoutPaymentArgs) {
	return (packageFromDb: Doc<"packages">) =>
		validatePackageClaimStripeSession(packageFromDb, args.stripeSessionId).map(
			keepValue(packageFromDb)
		);
}

function keepValue<T>(value: T) {
	return () => value;
}

function attachCheckoutClaimStatus(packageFromDb: Doc<"packages">) {
	return (claimStatus: PackageCheckoutClaimStatus<Doc<"packages">>) => ({
		claimStatus,
		packageFromDb
	});
}

function attachClaimStatusToPackage(packageFromDb: Doc<"packages">) {
	return getPackageCheckoutClaimStatus(packageFromDb).map(attachCheckoutClaimStatus(packageFromDb));
}

function finalizePackageCheckoutClaim(ctx: MutationCtx, args: ClaimPackageCheckoutPaymentArgs) {
	return ({
		claimStatus,
		packageFromDb
	}: {
		claimStatus: PackageCheckoutClaimStatus<Doc<"packages">>;
		packageFromDb: Doc<"packages">;
	}) => {
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
		}).map(toClaimedPackageCheckoutOutcome(packageId));
	};
}

function toClaimedPackageCheckoutOutcome(packageId: Id<"packages">) {
	return () => ({ outcome: "claimed" as const, packageId });
}

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
		.asyncAndThen(loadPackageForNormalizedId(ctx))
		.andThen(validateClaimStripeSessionForArgs(args))
		.andThen(attachClaimStatusToPackage)
		.andThen(finalizePackageCheckoutClaim(ctx, args));
}

function validatePendingPackageAbandonmentForSession(stripeSessionId: string) {
	return (packageFromDb: Doc<"packages">) =>
		validatePendingPackageAbandonment(packageFromDb, stripeSessionId);
}

function toAbandonedPackageOutcome(_archived: null): AbandonPendingPackageSuccess {
	return { outcome: "abandoned" };
}

function archiveAbandonedPendingPackage(ctx: MutationCtx, packageId: Id<"packages">) {
	return archiveDeadPackage(ctx, packageId, { status: "abandoned" }).map(toAbandonedPackageOutcome);
}

function resolvePendingPackageAbandonment(ctx: MutationCtx, packageId: Id<"packages">) {
	return (abandonDecision: AbandonPendingPackageDecision) => {
		if (abandonDecision.kind === "complete") {
			return ok(abandonDecision.value);
		}

		return archiveAbandonedPendingPackage(ctx, packageId);
	};
}

function mapPackageNotFoundToAbandonOutcome(
	error: { reason: "PACKAGE_NOT_FOUND" } | { reason: string }
) {
	return error.reason === "PACKAGE_NOT_FOUND"
		? ok({ outcome: "not_found" as const })
		: errAsync(error);
}

export function abandonPendingPackageCheckout(
	ctx: MutationCtx,
	args: { packageId: Id<"packages">; stripeSessionId: string }
) {
	return getPackageFromDb(ctx, args.packageId)
		.andThen(validatePendingPackageAbandonmentForSession(args.stripeSessionId))
		.andThen(resolvePendingPackageAbandonment(ctx, args.packageId))
		.orElse(mapPackageNotFoundToAbandonOutcome);
}

function toFreshlyExpiredPackage(_archived: null) {
	return { alreadyExpired: false };
}

function expirePendingPackageRecord(ctx: MutationCtx, packageId: Id<"packages">) {
	return archiveDeadPackage(ctx, packageId, { status: "expired" }).map(toFreshlyExpiredPackage);
}

function resolvePendingPackageExpiry(ctx: MutationCtx) {
	return (expireDecision: ExpirePackageDecision) => {
		if (expireDecision.kind === "complete") {
			return ok({ alreadyExpired: expireDecision.alreadyExpired });
		}

		return expirePendingPackageRecord(ctx, expireDecision.packageId);
	};
}

export function expirePendingPackageByStripeSessionId(ctx: MutationCtx, stripeSessionId: string) {
	return lookupPackageByStripeSessionId(ctx, stripeSessionId)
		.andThen(validatePackageExpiry)
		.andThen(resolvePendingPackageExpiry(ctx));
}

export function loadPackageRowByStripeSessionId(ctx: QueryCtx, stripeSessionId: string) {
	return lookupPackageByStripeSessionId(ctx, stripeSessionId);
}

function buildPublicPackageStatusIfPresent(packageFromDb: Doc<"packages"> | null) {
	return packageFromDb === null ? null : buildPublicPackageStatusResponse(packageFromDb);
}

export function loadPublicPackageStatusByStripeSessionId(ctx: QueryCtx, stripeSessionId: string) {
	return loadPackageRowByStripeSessionId(ctx, stripeSessionId).map(
		buildPublicPackageStatusIfPresent
	);
}
