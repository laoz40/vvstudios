import { err, ok, type Result } from "neverthrow";
import { exhaustiveCheck } from "#/lib/result";
import type { Doc } from "#convex/_generated/dataModel";

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

export type PackageCheckoutClaimStatus<T extends PackageCheckoutClaimPackage = PackageCheckoutClaimPackage> =
	| { kind: "already_completed" }
	| { kind: "already_claimed" }
	| { kind: "pending"; packageFromDb: T };

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
		case "invoice_email_failed":
			return err({ reason: "STRIPE_SESSION_MISMATCH" });
		default:
			return exhaustiveCheck(packageFromDb.status);
	}
}
