"use node";

import { v } from "convex/values";
import { tupleErr, tupleOk, type Result } from "#/lib/result";
import { internalAction } from "#convex/_generated/server";
import { completeClaimedPackageCheckoutService } from "#convex/services/packageCheckoutCompletionActions";

type CompleteClaimedPackageCheckoutSuccess = { outcome: "completed" };

type CompleteClaimedPackageCheckoutError =
	| { reason: "PACKAGE_ALREADY_PAID" }
	| { reason: "PACKAGE_NOT_FOUND" }
	| { reason: "PACKAGE_SCHEDULE_EMAIL_FAILED" }
	| { reason: "PACKAGE_SCHEDULE_EMAIL_FAILED_AND_STATUS_UPDATE_FAILED" }
	| { reason: "PACKAGE_SCHEDULE_EMAIL_SENT_STATUS_UPDATE_FAILED" };

export const completeClaimedPackageCheckout = internalAction({
	args: { packageId: v.id("packages") },
	handler: async (
		ctx,
		args
	): Promise<Result<CompleteClaimedPackageCheckoutSuccess, CompleteClaimedPackageCheckoutError>> =>
		(await completeClaimedPackageCheckoutService(ctx, args)).match(tupleOk, tupleErr)
});
