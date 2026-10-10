import { err, errAsync, ok, okAsync, type Result, type ResultAsync } from "neverthrow";
import type { Doc, Id } from "#convex/_generated/dataModel";
import type { MutationCtx } from "#convex/_generated/server";
import { archiveDeadPackage } from "#convex/packages/lib/archive";

export type ExpirePackageError =
	| { reason: "PACKAGE_NOT_FOUND" }
	| { reason: "PACKAGE_INVALID_STATUS"; status: Doc<"packages">["status"] };

export type ExpirePackageDecision =
	| { kind: "complete"; alreadyExpired: true }
	| { kind: "expire"; packageId: Doc<"packages">["_id"] };

export type AbandonPendingPackageSuccess =
	| { outcome: "not_found" }
	| { outcome: "not_pending"; status: Doc<"packages">["status"] }
	| { outcome: "abandoned" };

export type AbandonPendingPackageDecision =
	| { kind: "complete"; value: AbandonPendingPackageSuccess }
	| { kind: "abandon" };

export function validatePackageExpiry(
	packageFromDb: Doc<"packages"> | null
): Result<ExpirePackageDecision, ExpirePackageError> {
	if (!packageFromDb) return err({ reason: "PACKAGE_NOT_FOUND" });

	if (packageFromDb.status === "expired") {
		return ok({ kind: "complete", alreadyExpired: true });
	}

	if (packageFromDb.status !== "pending_payment") {
		return err({ reason: "PACKAGE_INVALID_STATUS", status: packageFromDb.status });
	}

	return ok({ kind: "expire", packageId: packageFromDb._id });
}

export function validatePendingPackageAbandonment(
	packageFromDb: Doc<"packages">,
	stripeSessionId: string
): Result<AbandonPendingPackageDecision, { reason: "STRIPE_SESSION_MISMATCH" }> {
	if (packageFromDb.stripeSessionId !== stripeSessionId) {
		return err({ reason: "STRIPE_SESSION_MISMATCH" });
	}

	if (packageFromDb.status !== "pending_payment") {
		return ok({
			kind: "complete",
			value: { outcome: "not_pending", status: packageFromDb.status }
		});
	}

	return ok({ kind: "abandon" });
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

export function validateActivePackageForInstagramUpdate(
	packageFromDb: Doc<"packages">
): Result<Doc<"packages">, { reason: "PACKAGE_NOT_ACTIVE" }> {
	if (packageFromDb.status !== "pending_payment" && packageFromDb.status !== "paid") {
		return err({ reason: "PACKAGE_NOT_ACTIVE" });
	}

	return ok(packageFromDb);
}

function writeDeadPackageStatus(
	ctx: MutationCtx,
	packageId: Id<"packages">,
	status: "expired" | "abandoned"
): ResultAsync<null, never> {
	return archiveDeadPackage(ctx, packageId, { status });
}

export function writeExpiredPackage(
	ctx: MutationCtx,
	packageId: Id<"packages">
): ResultAsync<{ alreadyExpired: false }, never> {
	return writeDeadPackageStatus(ctx, packageId, "expired").map(() => ({
		alreadyExpired: false as const
	}));
}

export function writeAbandonedPackage(
	ctx: MutationCtx,
	packageId: Id<"packages">
): ResultAsync<Extract<AbandonPendingPackageSuccess, { outcome: "abandoned" }>, never> {
	return writeDeadPackageStatus(ctx, packageId, "abandoned").map(() => ({
		outcome: "abandoned" as const
	}));
}

export function expirePackageAfterValidate(
	ctx: MutationCtx,
	decision: ExpirePackageDecision
): ResultAsync<{ alreadyExpired: boolean }, never> {
	if (decision.kind === "complete") {
		return okAsync({ alreadyExpired: decision.alreadyExpired });
	}

	return writeExpiredPackage(ctx, decision.packageId);
}

export function abandonPackageAfterValidate(
	ctx: MutationCtx,
	packageId: Id<"packages">,
	decision: AbandonPendingPackageDecision
): ResultAsync<AbandonPendingPackageSuccess, never> {
	if (decision.kind === "complete") {
		return okAsync(decision.value);
	}

	return writeAbandonedPackage(ctx, packageId);
}

export function mapPackageNotFoundToAbandonOutcome(
	error: { reason: "PACKAGE_NOT_FOUND" } | { reason: string }
) {
	return error.reason === "PACKAGE_NOT_FOUND"
		? ok({ outcome: "not_found" as const })
		: errAsync(error);
}
