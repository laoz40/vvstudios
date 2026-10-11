import { okAsync } from "neverthrow";
import { internal } from "#convex/_generated/api";
import type { ActionCtx } from "#convex/_generated/server";
import { fromConvexTuple } from "#convex/shared/lib/result";
import type { PackageCheckoutClaim } from "#convex/packages/lib/checkoutClaim";

export function completeClaimedPackageCheckoutOperation(
	ctx: ActionCtx,
	claim: PackageCheckoutClaim
) {
	if (claim.outcome === "already_completed") {
		return okAsync({ outcome: "already_completed" as const });
	}

	return fromConvexTuple(
		ctx.runAction(internal.packages.checkoutCompletionHandlers.completeClaimedPackageCheckout, {
			packageId: claim.packageId
		})
	);
}

export function claimPackageCheckoutPaymentOperation(
	ctx: ActionCtx,
	args: {
		packageId: string;
		stripeSessionId: string;
		stripePaymentIntentId?: string;
		originalPaidAmount?: number;
	}
) {
	return fromConvexTuple(
		ctx.runMutation(internal.packages.checkout.claimPackageCheckoutPayment, args)
	);
}
