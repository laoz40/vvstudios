import { okAsync, type ResultAsync } from "neverthrow";
import { exhaustiveCheck } from "#/lib/result";
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
				| { reason: "EMAIL_REQUEST_FAILED" }
				| { reason: "EMAIL_RESPONSE_FAILED" }
				| { reason: "PACKAGE_ALREADY_PAID" }
				| { reason: "PACKAGE_NOT_FOUND" }
				| { reason: "PACKAGE_SCHEDULE_EMAIL_FAILED" }
				| { reason: "SCHEDULE_EMAIL_RENDER_FAILED" };
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
			const claimOutcome = claim.outcome;

			switch (claimOutcome) {
				case "already_completed":
				case "already_claimed":
					return okAsync({ outcome: "already_completed" as const });
				case "claimed":
					return fromConvexTuple(
						ctx.runAction(
							internal.packageCheckoutCompletionHandlers.completeClaimedPackageCheckout,
							{ packageId: claim.packageId }
						)
					).mapErr((error) => ({ kind: "completion_failed" as const, error }));
				default:
					return exhaustiveCheck(claimOutcome);
			}
		});
}
