import { err, errAsync, ok, okAsync, ResultAsync } from "neverthrow";
import type { Doc, Id } from "#convex/_generated/dataModel";
import type { MutationCtx } from "#convex/_generated/server";
import {
	validatePackageExpiry,
	validatePendingPackageAbandonment,
	type AbandonPendingPackageSuccess
} from "#convex/lib/packageCheckout";
import {
	getPackageCheckoutClaimStatus,
	validatePackageClaimStripeSession
} from "#convex/lib/packageCheckoutClaim";
import { archiveDeadPackage } from "#convex/lib/packageArchive";
import { getPackageFromDb } from "#convex/lib/packageLookup";
import { okOrThrow } from "#convex/lib/result";

export function markPackageExpiredByStripeSessionIdService(
	ctx: MutationCtx,
	args: { stripeSessionId: string }
) {
	return (
		okOrThrow(
			ctx.db
				.query("packages")
				.withIndex("by_stripeSessionId", (indexQuery) =>
					indexQuery.eq("stripeSessionId", args.stripeSessionId)
				)
				.unique()
		)
			.andThen(validatePackageExpiry)
			// Preserve idempotency or apply the expiry transition.
			.andThen((expireDecision) => {
				if (expireDecision.kind === "complete") {
					return ok({ alreadyExpired: expireDecision.alreadyExpired });
				}

				return archiveDeadPackage(ctx, expireDecision.packageId, { status: "expired" }).map(() => ({
					alreadyExpired: false
				}));
			})
	);
}

export function abandonPendingPackageService(
	ctx: MutationCtx,
	args: { packageId: Id<"packages">; stripeSessionId: string }
) {
	return (
		getPackageFromDb(ctx, args.packageId)
			.andThen((packageFromDb) =>
				validatePendingPackageAbandonment(packageFromDb, args.stripeSessionId)
			)
			// Preserve idempotency or abandon the pending package.
			.andThen((abandonDecision) => {
				if (abandonDecision.kind === "complete") {
					return ok(abandonDecision.value);
				}

				return archiveDeadPackage(ctx, args.packageId, { status: "abandoned" }).map(
					(): AbandonPendingPackageSuccess => ({ outcome: "abandoned" })
				);
			})
			.orElse((error) =>
				error.reason === "PACKAGE_NOT_FOUND" ? ok({ outcome: "not_found" as const }) : err(error)
			)
	);
}

export type PackageCheckoutClaim =
	| { outcome: "already_completed"; packageId: Id<"packages"> }
	| { outcome: "already_claimed"; packageId: Id<"packages"> }
	| { outcome: "claimed"; packageId: Id<"packages"> };

type PackageCheckoutClaimError = { reason: "PACKAGE_NOT_FOUND" | "STRIPE_SESSION_MISMATCH" };

export function claimPackageCheckoutPaymentService(
	ctx: MutationCtx,
	args: { packageId: string; stripeSessionId: string; stripePaymentIntentId?: string }
): ResultAsync<PackageCheckoutClaim, PackageCheckoutClaimError> {
	const normalizedPackageId = ctx.db.normalizeId("packages", args.packageId);

	if (!normalizedPackageId) {
		return errAsync({ reason: "PACKAGE_NOT_FOUND" as const });
	}

	return getPackageFromDb(ctx, normalizedPackageId)
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

			return okOrThrow(
				ctx.db
					.patch(packageFromDb._id, {
						packageCheckoutClaimedAt: now,
						stripePaymentIntentId: args.stripePaymentIntentId
					})
					.then(() => ({ outcome: "claimed" as const, packageId }))
			);
		});
}

export function buildPublicPackageStatusResponse(packageFromDb: Doc<"packages">) {
	return {
		_id: packageFromDb._id,
		status: packageFromDb.status,
		packageSize: packageFromDb.packageSize,
		paidAt: packageFromDb.paidAt,
		createdAt: packageFromDb.createdAt
	};
}
