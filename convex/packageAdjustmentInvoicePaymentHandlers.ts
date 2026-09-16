"use node";

import { v } from "convex/values";
import { tupleErr, tupleOk, type Result } from "#/lib/result";
import { internalAction } from "#convex/_generated/server";
import { sendPackageAdjustmentReceiptAfterPaymentService } from "#convex/services/packageAdjustmentInvoicePaymentActions";

type SendPackageAdjustmentReceiptAfterPaymentSuccess = { outcome: "completed" };

type SendPackageAdjustmentReceiptAfterPaymentError =
	| { reason: "PACKAGE_ADJUSTMENT_INVOICE_NOT_SENT" }
	| { reason: "PACKAGE_ADJUSTMENT_NOT_FOUND" }
	| {
			reason:
				| "EMAIL_REQUEST_FAILED"
				| "EMAIL_RESPONSE_FAILED"
				| "INVALID_BOOKING_DATA"
				| "RECEIPT_EMAIL_RENDER_FAILED"
				| "RECEIPT_PDF_RENDER_FAILED";
	  };

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
