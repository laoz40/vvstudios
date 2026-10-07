import { okAsync } from "neverthrow";
import type { Doc, Id } from "#convex/_generated/dataModel";
import type { MutationCtx, QueryCtx } from "#convex/_generated/server";
import {
	abandonPackageAfterValidate,
	buildPublicPackageStatusResponse,
	expirePackageAfterValidate,
	mapPackageNotFoundToAbandonOutcome,
	validatePackageExpiry,
	validatePendingPackageAbandonment
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
	originalPaidAmount?: number;
};

function attachCheckoutClaimStatus(
	packageFromDb: Doc<"packages">,
	claimStatus: PackageCheckoutClaimStatus<Doc<"packages">>
) {
	return { claimStatus, packageFromDb };
}

function attachClaimStatusToPackage(packageFromDb: Doc<"packages">) {
	return getPackageCheckoutClaimStatus(packageFromDb).map(
		(claimStatus: PackageCheckoutClaimStatus<Doc<"packages">>) =>
			attachCheckoutClaimStatus(packageFromDb, claimStatus)
	);
}

function finalizePackageCheckoutClaim(
	ctx: MutationCtx,
	args: ClaimPackageCheckoutPaymentArgs,
	{
		claimStatus,
		packageFromDb
	}: { claimStatus: PackageCheckoutClaimStatus<Doc<"packages">>; packageFromDb: Doc<"packages"> }
) {
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
		originalPaidAmount: args.originalPaidAmount,
		stripePaymentIntentId: args.stripePaymentIntentId
	}).map(() => ({ outcome: "claimed" as const, packageId }));
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
		.asyncAndThen((normalizedPackageId: Id<"packages">) =>
			getPackageFromDb(ctx, normalizedPackageId)
		)
		.andThen((packageFromDb: Doc<"packages">) =>
			validatePackageClaimStripeSession(packageFromDb, args.stripeSessionId).map(
				() => packageFromDb
			)
		)
		.andThen(attachClaimStatusToPackage)
		.andThen((value) => finalizePackageCheckoutClaim(ctx, args, value));
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

function buildPublicPackageStatusIfPresent(packageFromDb: Doc<"packages"> | null) {
	return packageFromDb === null ? null : buildPublicPackageStatusResponse(packageFromDb);
}

export function loadPublicPackageStatusByStripeSessionId(ctx: QueryCtx, stripeSessionId: string) {
	return loadPackageRowByStripeSessionId(ctx, stripeSessionId).map(
		buildPublicPackageStatusIfPresent
	);
}
