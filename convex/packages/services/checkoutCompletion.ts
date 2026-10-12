import {
	completeClaimedPackageCheckoutOperation,
	claimPackageCheckoutPaymentOperation
} from "#convex/packages/lib/checkoutCompletionIo";
import { ok, safeTry } from "neverthrow";

import type { ActionCtx } from "#convex/_generated/server";

import { type PackageCheckoutClaim } from "#convex/packages/lib/checkoutClaim";

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
) {
	return safeTry(async function* () {
		const checkoutClaim = yield* claimPackageCheckoutPaymentOperation(ctx, args).mapErr(
			(error) => ({ kind: "claim_failed" as const, error })
		);

		const completion = yield* completeClaimedPackageCheckout(ctx, checkoutClaim);

		return ok(completion);
	});
}
