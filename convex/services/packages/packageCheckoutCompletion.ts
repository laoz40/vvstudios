import { okAsync, type ResultAsync } from "neverthrow";
import { exhaustiveCheck } from "#/lib/result";
import { internal } from "#convex/_generated/api";
import type { ActionCtx } from "#convex/_generated/server";
import { fromConvexTuple } from "#convex/lib/result";
import type { PackageCheckoutClaim } from "#convex/lib/packages/packageCheckoutClaim";
import type { CompleteClaimedPackageCheckoutError } from "#convex/services/packages/claimedPackageCheckoutCompletion";

type CompletePackageCheckoutSuccess = { outcome: "already_completed" | "completed" };

type CompletePackageCheckoutFailure =
	| { kind: "claim_failed"; error: { reason: "PACKAGE_NOT_FOUND" | "STRIPE_SESSION_MISMATCH" } }
	| { kind: "completion_failed"; error: CompleteClaimedPackageCheckoutError };

function mapPackageCheckoutClaimFailed(error: {
	reason: "PACKAGE_NOT_FOUND" | "STRIPE_SESSION_MISMATCH";
}) {
	return { kind: "claim_failed" as const, error };
}

function completePackageCheckoutFromClaim(ctx: ActionCtx, claim: PackageCheckoutClaim) {
	const claimOutcome = claim.outcome;

	switch (claimOutcome) {
		case "already_completed":
		case "already_claimed":
			return okAsync({ outcome: "already_completed" as const });
		case "claimed":
			return fromConvexTuple(
				ctx.runAction(internal.packageCheckoutCompletionHandlers.completeClaimedPackageCheckout, {
					packageId: claim.packageId
				})
			).mapErr(mapPackageCheckoutCompletionFailed);
		default:
			return exhaustiveCheck(claimOutcome);
	}
}

function mapPackageCheckoutCompletionFailed(error: CompleteClaimedPackageCheckoutError) {
	return { kind: "completion_failed" as const, error };
}

export function completePackageCheckoutService(
	ctx: ActionCtx,
	args: { packageId: string; stripeSessionId: string; stripePaymentIntentId?: string }
): ResultAsync<CompletePackageCheckoutSuccess, CompletePackageCheckoutFailure> {
	return fromConvexTuple(
		ctx.runMutation(internal.packageCheckout.claimPackageCheckoutPayment, args)
	)
		.mapErr(mapPackageCheckoutClaimFailed)
		.andThen((claim: PackageCheckoutClaim) => completePackageCheckoutFromClaim(ctx, claim));
}
