import { okAsync, type ResultAsync } from "neverthrow";
import { internal } from "#convex/_generated/api";
import type { ActionCtx } from "#convex/_generated/server";
import { fromConvexTuple } from "#convex/lib/result";
import type { PackageCheckoutClaim } from "#convex/services/packageCheckout";

type CompletePackageCheckoutSuccess = { outcome: "already_completed" | "completed" };

type CompletePackageCheckoutFailure =
	| { kind: "claim_failed"; error: { reason: "PACKAGE_NOT_FOUND" | "STRIPE_SESSION_MISMATCH" } }
	| {
			kind: "completion_failed";
			error:
				| { reason: "PACKAGE_ALREADY_PAID" }
				| { reason: "PACKAGE_NOT_FOUND" }
				| { reason: "PACKAGE_SCHEDULE_EMAIL_FAILED" }
				| { reason: "PACKAGE_SCHEDULE_EMAIL_FAILED_AND_STATUS_UPDATE_FAILED" }
				| { reason: "PACKAGE_SCHEDULE_EMAIL_SENT_STATUS_UPDATE_FAILED" };
	  };

export function completePackageCheckoutService(
	ctx: ActionCtx,
	args: { packageId: string; stripeSessionId: string; stripePaymentIntentId?: string }
): ResultAsync<CompletePackageCheckoutSuccess, CompletePackageCheckoutFailure> {
	return fromConvexTuple(
		ctx.runMutation(internal.packageCheckout.claimPackageCheckoutPayment, args)
	)
		.mapErr((error) => ({ kind: "claim_failed" as const, error }))
		.andThen((claim: PackageCheckoutClaim) => {
			if (claim.outcome === "already_completed") {
				return okAsync({ outcome: "already_completed" as const });
			}

			return fromConvexTuple(
				ctx.runAction(internal.packageCheckoutCompletionHandlers.completeClaimedPackageCheckout, {
					packageId: claim.packageId
				})
			).mapErr((error) => ({ kind: "completion_failed" as const, error }));
		});
}
