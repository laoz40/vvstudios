import {
	completeClaimedPackageCheckoutOperation,
	claimPackageCheckoutPaymentOperation
} from "#convex/packages/lib/checkoutCompletionIo";
import { type ResultAsync } from "neverthrow";

import type { ActionCtx } from "#convex/_generated/server";

import { type PackageCheckoutClaim } from "#convex/packages/lib/checkoutClaim";
import type { CompleteClaimedPackageCheckoutError } from "#convex/packages/services/claimedCheckoutCompletion";

type CompletePackageCheckoutSuccess = { outcome: "already_completed" | "completed" };

type CompletePackageCheckoutFailure =
	| { kind: "claim_failed"; error: { reason: "PACKAGE_NOT_FOUND" | "STRIPE_SESSION_MISMATCH" } }
	| { kind: "completion_failed"; error: CompleteClaimedPackageCheckoutError };

function completeClaimedPackageCheckout(ctx: ActionCtx, claim: PackageCheckoutClaim) {
	return completeClaimedPackageCheckoutOperation(ctx, claim).mapErr((error) => ({
		kind: "completion_failed" as const,
		error
	}));
}

export function completePackageCheckoutService(
	ctx: ActionCtx,
	args: {
		packageId: string;
		stripeSessionId: string;
		stripePaymentIntentId?: string;
		originalPaidAmount?: number;
	}
): ResultAsync<CompletePackageCheckoutSuccess, CompletePackageCheckoutFailure> {
	return claimPackageCheckoutPaymentOperation(ctx, args)
		.mapErr((error) => ({ kind: "claim_failed" as const, error }))
		.andThen((claim: PackageCheckoutClaim) => completeClaimedPackageCheckout(ctx, claim));
}
