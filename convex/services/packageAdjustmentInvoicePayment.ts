"use node";

import { okAsync, ResultAsync } from "neverthrow";
import { api, internal } from "#convex/_generated/api";
import type { ActionCtx } from "#convex/_generated/server";
import { sendPackageAdjustmentReceiptEmails } from "#convex/lib/bookingDocumentEmails";
import type { PackageAdjustmentInvoicePaymentClaimError } from "#convex/lib/packageAdjustmentInvoicePayment";
import type { BookingAvailabilitySettings } from "#studio/lib/bookingAvailabilitySettings";
import { fromConvexTuple, okOrThrow } from "#convex/lib/result";

type CompletePackageAdjustmentInvoicePaymentSuccess = {
	outcome: "already_completed" | "completed";
};

type CompletePackageAdjustmentInvoicePaymentFailure =
	| { kind: "claim_failed"; error: PackageAdjustmentInvoicePaymentClaimError }
	| {
			kind: "completion_failed";
			error:
				| { reason: "INVALID_BOOKING_DATA" }
				| { reason: "RECEIPT_EMAIL_RENDER_FAILED" }
				| { reason: "RECEIPT_SEND_FAILED" };
	  };

export function completePackageAdjustmentInvoicePaymentService(
	ctx: ActionCtx,
	args: { stripeInvoiceId: string; adjustmentId?: string; paidAt: number }
): ResultAsync<
	CompletePackageAdjustmentInvoicePaymentSuccess,
	CompletePackageAdjustmentInvoicePaymentFailure
> {
	return fromConvexTuple(
		ctx.runMutation(internal.packageAdjustments.claimPackageAdjustmentInvoicePayment, args)
	)
		.mapErr((error) => ({ kind: "claim_failed" as const, error }))
		.andThen((claim) => {
			if (claim.outcome === "already_completed") {
				return okAsync({ outcome: "already_completed" as const });
			}

			return fromConvexTuple(
				ctx.runQuery(internal.packageAdjustments.getPackageAdjustmentInvoiceInput, {
					adjustmentId: claim.adjustmentId
				})
			)
				.mapErr((error) => ({ kind: "claim_failed" as const, error }))
				.andThen((invoiceInput) =>
					okOrThrow<BookingAvailabilitySettings>(ctx.runQuery(api.bookingSettings.get, {})).map(
						(bookingSettings) => ({ bookingSettings, invoiceInput })
					)
				)
				.andThen(({ bookingSettings, invoiceInput }) =>
					okOrThrow(
						sendPackageAdjustmentReceiptEmails(
							invoiceInput,
							args.paidAt,
							bookingSettings.leadTimeMinutes
						)
					).mapErr((error) => ({ kind: "completion_failed" as const, error }))
				)
				.map(() => ({ outcome: "completed" as const }));
		});
}
