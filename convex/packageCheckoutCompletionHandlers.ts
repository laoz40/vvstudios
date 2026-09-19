"use node";

import { v } from "convex/values";
import { tupleErr, tupleOk, type Result } from "#/lib/result";
import { internalAction } from "#convex/_generated/server";
import { completeClaimedPackageCheckoutService } from "#convex/services/packageCheckoutCompletionActions";

type CompleteClaimedPackageCheckoutSuccess = { outcome: "completed" };

type CompleteClaimedPackageCheckoutError =
	| { reason: "EMAIL_REQUEST_FAILED" }
	| { reason: "EMAIL_RESPONSE_FAILED" }
	| { reason: "INVALID_BOOKING_DATA" }
	| { reason: "PACKAGE_ALREADY_PAID" }
	| { reason: "PACKAGE_NOT_FOUND" }
	| { reason: "PACKAGE_SCHEDULE_EMAIL_FAILED" }
	| { reason: "RECEIPT_EMAIL_RENDER_FAILED" }
	| { reason: "RECEIPT_PDF_RENDER_FAILED" }
	| { reason: "SCHEDULE_EMAIL_RENDER_FAILED" };

export const completeClaimedPackageCheckout = internalAction({
	args: { packageId: v.id("packages") },
	handler: async (
		ctx,
		args
	): Promise<Result<CompleteClaimedPackageCheckoutSuccess, CompleteClaimedPackageCheckoutError>> =>
		(await completeClaimedPackageCheckoutService(ctx, args)).match(tupleOk, tupleErr)
});
