import { err, ok, okAsync, type Result } from "neverthrow";
import { exhaustiveCheck } from "#/lib/result";
import type { Doc, Id } from "#convex/_generated/dataModel";
import type { MutationCtx } from "#convex/_generated/server";
import { patchPackageCheckoutClaimed } from "#convex/packages/lib/updates";

export type PackageCheckoutClaim =
	| { outcome: "already_completed"; packageId: Id<"packages"> }
	| { outcome: "already_claimed"; packageId: Id<"packages"> }
	| { outcome: "claimed"; packageId: Id<"packages"> };

export type PackageCheckoutClaimPackage = Pick<
	Doc<"packages">,
	"status" | "stripeSessionId" | "packageCheckoutClaimedAt"
>;

export function validatePackageClaimStripeSession<T extends PackageCheckoutClaimPackage>(
	packageFromDb: T,
	stripeSessionId: string
) {
	if (packageFromDb.stripeSessionId !== stripeSessionId) {
		return err({ reason: "STRIPE_SESSION_MISMATCH" as const });
	}

	return ok(packageFromDb);
}

export type PackageCheckoutClaimStatus<
	T extends PackageCheckoutClaimPackage = PackageCheckoutClaimPackage
> =
	| { kind: "already_completed" }
	| { kind: "already_claimed" }
	| { kind: "pending"; packageFromDb: T };

export function buildPackageCheckoutClaimPatch(
	args: { originalPaidAmount?: number; stripePaymentIntentId?: string },
	now: number
) {
	return {
		packageCheckoutClaimedAt: now,
		originalPaidAmount: args.originalPaidAmount,
		stripePaymentIntentId: args.stripePaymentIntentId
	};
}

export function getPackageCheckoutClaimStatus<T extends PackageCheckoutClaimPackage>(
	packageFromDb: T
): Result<PackageCheckoutClaimStatus<T>, { reason: "STRIPE_SESSION_MISMATCH" }> {
	switch (packageFromDb.status) {
		case "paid":
		case "schedule_email_failed":
			return ok({ kind: "already_completed" });
		case "pending_payment":
			return packageFromDb.packageCheckoutClaimedAt
				? ok({ kind: "already_claimed" })
				: ok({ kind: "pending", packageFromDb });
		case "abandoned":
		case "expired":
			return err({ reason: "STRIPE_SESSION_MISMATCH" });
		default:
			return exhaustiveCheck(packageFromDb.status);
	}
}

export function writePackageCheckoutClaimIfPending(
	ctx: MutationCtx,
	args: { originalPaidAmount?: number; stripePaymentIntentId?: string },
	packageRecord: Doc<"packages">,
	claim: PackageCheckoutClaimStatus<Doc<"packages">>
) {
	if (claim.kind !== "pending") {
		return okAsync<PackageCheckoutClaim>({ outcome: claim.kind, packageId: packageRecord._id });
	}

	return patchPackageCheckoutClaimed(
		ctx,
		packageRecord._id,
		buildPackageCheckoutClaimPatch(args, Date.now())
	).map(() => ({ outcome: "claimed" as const, packageId: packageRecord._id }));
}
