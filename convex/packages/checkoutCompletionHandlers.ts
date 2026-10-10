"use node";

import { v } from "convex/values";
import { tupleErr, tupleOk, type Result } from "#/lib/result";
import { internalAction } from "#convex/_generated/server";
import {
	completeClaimedPackageCheckoutAfterPayment,
	type CompleteClaimedPackageCheckoutError,
	type CompleteClaimedPackageCheckoutSuccess
} from "#convex/packages/services/claimedCheckoutCompletion";

export const completeClaimedPackageCheckout = internalAction({
	args: { packageId: v.id("packages") },
	handler: (
		ctx,
		args
	): Promise<Result<CompleteClaimedPackageCheckoutSuccess, CompleteClaimedPackageCheckoutError>> =>
		completeClaimedPackageCheckoutAfterPayment(ctx, args.packageId).match(tupleOk, tupleErr)
});
