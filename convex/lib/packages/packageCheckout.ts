import { err, ok, type Result } from "neverthrow";
import type { Doc } from "#convex/_generated/dataModel";

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
