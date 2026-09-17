"use node";

import { api, internal } from "#convex/_generated/api";
import type { ResultAsync } from "neverthrow";
import type { Id } from "#convex/_generated/dataModel";
import type { ActionCtx } from "#convex/_generated/server";
import { sendPackageAdjustmentReceiptEmails } from "#convex/lib/bookingDocumentEmails";
import { fromConvexTuple, okOrThrow } from "#convex/lib/result";
import type { BookingAvailabilitySettings } from "#studio/lib/bookingAvailabilitySettings";

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

export function sendPackageAdjustmentReceiptAfterPaymentService(
	ctx: ActionCtx,
	args: { adjustmentId: Id<"packageAdjustments">; paidAt: number }
): ResultAsync<
	SendPackageAdjustmentReceiptAfterPaymentSuccess,
	SendPackageAdjustmentReceiptAfterPaymentError
> {
	return fromConvexTuple(
		ctx.runQuery(internal.packageAdjustments.getPackageAdjustmentInvoiceInput, {
			adjustmentId: args.adjustmentId
		})
	)
		.andThen((invoiceInput) =>
			okOrThrow<BookingAvailabilitySettings>(ctx.runQuery(api.bookingSettings.get, {})).map(
				(bookingSettings) => ({ bookingSettings, invoiceInput })
			)
		)
		.andThen(({ bookingSettings, invoiceInput }) =>
			sendPackageAdjustmentReceiptEmails(invoiceInput, args.paidAt, bookingSettings.leadTimeMinutes)
		)
		.map(() => ({ outcome: "completed" as const }));
}
