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
	| { reason: "INVALID_BOOKING_DATA" }
	| { reason: "RECEIPT_EMAIL_RENDER_FAILED" }
	| { reason: "RECEIPT_SEND_FAILED" };

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
		.mapErr(() => ({ reason: "INVALID_BOOKING_DATA" as const }))
		.andThen((invoiceInput) =>
			okOrThrow<BookingAvailabilitySettings>(ctx.runQuery(api.bookingSettings.get, {})).map(
				(bookingSettings) => ({ bookingSettings, invoiceInput })
			)
		)
		.andThen(({ bookingSettings, invoiceInput }) =>
			sendPackageAdjustmentReceiptEmails(
				invoiceInput,
				args.paidAt,
				bookingSettings.leadTimeMinutes
			).mapErr(() => ({ reason: "RECEIPT_SEND_FAILED" as const }))
		)
		.map(() => ({ outcome: "completed" as const }));
}
