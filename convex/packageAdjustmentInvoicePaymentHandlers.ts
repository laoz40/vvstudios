"use node";

import { v } from "convex/values";
import { tupleErr, tupleOk, type Result } from "#/lib/result";
import { internalAction } from "#convex/_generated/server";
import { sendPackageAdjustmentReceiptAfterPaymentService } from "#convex/services/packageAdjustmentInvoicePaymentActions";

type SendPackageAdjustmentReceiptAfterPaymentSuccess = { outcome: "completed" };

type SendPackageAdjustmentReceiptAfterPaymentError =
	| { reason: "INVALID_BOOKING_DATA" }
	| { reason: "RECEIPT_EMAIL_RENDER_FAILED" }
	| { reason: "RECEIPT_SEND_FAILED" };

export const sendPackageAdjustmentReceiptAfterPayment = internalAction({
	args: { adjustmentId: v.id("packageAdjustments"), paidAt: v.number() },
	handler: async (
		ctx,
		args
	): Promise<
		Result<
			SendPackageAdjustmentReceiptAfterPaymentSuccess,
			SendPackageAdjustmentReceiptAfterPaymentError
		>
	> => (await sendPackageAdjustmentReceiptAfterPaymentService(ctx, args)).match(tupleOk, tupleErr)
});
