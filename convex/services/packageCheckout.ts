import { err, errAsync, ok, okAsync, ResultAsync } from "neverthrow";
import type { Doc, Id } from "#convex/_generated/dataModel";
import type { MutationCtx } from "#convex/_generated/server";
import {
	validatePackageExpiry,
	validatePendingPackageDeletion,
	type DeletePendingPackageSuccess
} from "#convex/lib/packageCheckout";
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

				return okOrThrow(
					ctx.db
						.patch(expireDecision.packageId, { status: "expired" })
						.then(() => ({ alreadyExpired: false }))
				);
			})
	);
}

export function deletePendingPackageService(
	ctx: MutationCtx,
	args: { packageId: Id<"packages">; stripeSessionId: string }
) {
	return (
		getPackageFromDb(ctx, args.packageId)
			.andThen((packageFromDb) =>
				validatePendingPackageDeletion(packageFromDb, args.stripeSessionId)
			)
			// Preserve idempotency or abandon the pending package.
			.andThen((deleteDecision) => {
				if (deleteDecision.kind === "complete") {
					return ok(deleteDecision.value);
				}

				return okOrThrow(
					ctx.db
						.patch(args.packageId, { status: "abandoned" })
						.then((): DeletePendingPackageSuccess => ({ outcome: "abandoned" }))
				);
			})
			.orElse((error) =>
				error.reason === "PACKAGE_NOT_FOUND" ? ok({ outcome: "not_found" as const }) : err(error)
			)
	);
}

export type PackageCheckoutClaim =
	| { outcome: "already_completed"; packageId: Id<"packages"> }
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

	return getPackageFromDb(ctx, normalizedPackageId).andThen((packageFromDb) => {
		if (packageFromDb.stripeSessionId !== args.stripeSessionId) {
			return errAsync({ reason: "STRIPE_SESSION_MISMATCH" as const });
		}

		if (packageFromDb.status === "paid" || packageFromDb.status === "schedule_email_failed") {
			return okAsync({ outcome: "already_completed" as const, packageId: packageFromDb._id });
		}

		if (packageFromDb.status !== "pending_payment") {
			return errAsync({ reason: "STRIPE_SESSION_MISMATCH" as const });
		}

		return okOrThrow(
			ctx.db
				.patch(packageFromDb._id, { stripePaymentIntentId: args.stripePaymentIntentId })
				.then(() => ({ outcome: "claimed" as const, packageId: packageFromDb._id }))
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
