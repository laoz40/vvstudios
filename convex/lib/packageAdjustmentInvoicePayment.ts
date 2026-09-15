import { err, errAsync, ok, okAsync, type Result, type ResultAsync } from "neverthrow";
import type { Doc, Id } from "#convex/_generated/dataModel";
import type { MutationCtx, QueryCtx } from "#convex/_generated/server";
import { getPackageAdjustmentInvoice } from "#convex/lib/packageAdjustments";
import { okOrThrow } from "#convex/lib/result";

type InvoiceRequiredAdjustment = Extract<
	Doc<"packageAdjustments">,
	{ outcome: "invoice_required" }
>;

export type PackageAdjustmentInvoicePaymentClaim =
	| { outcome: "already_completed" }
	| { outcome: "completed"; adjustmentId: Id<"packageAdjustments">; packageId: Id<"packages"> };

export type PackageAdjustmentInvoicePaymentClaimError =
	| { reason: "PACKAGE_ADJUSTMENT_NOT_FOUND" }
	| { reason: "PACKAGE_ADJUSTMENT_INVOICE_NOT_SENT" }
	| { reason: "STRIPE_INVOICE_MISMATCH" };

type PayableAdjustmentDecision =
	| { outcome: "already_completed" }
	| { outcome: "ready"; adjustment: InvoiceRequiredAdjustment };

function getPackageAdjustmentByStripeInvoiceId(
	ctx: QueryCtx | MutationCtx,
	stripeInvoiceId: string
): ResultAsync<InvoiceRequiredAdjustment, PackageAdjustmentInvoicePaymentClaimError> {
	return okOrThrow(
		ctx.db
			.query("packageAdjustments")
			.withIndex("by_stripeInvoiceId", (indexQuery) =>
				indexQuery.eq("stripeInvoiceId", stripeInvoiceId)
			)
			.unique()
	).andThen((adjustment) => {
		if (!adjustment || adjustment.outcome !== "invoice_required") {
			return errAsync({ reason: "PACKAGE_ADJUSTMENT_NOT_FOUND" as const });
		}

		return okAsync(adjustment);
	});
}

function resolvePackageAdjustmentForPayment(
	ctx: MutationCtx,
	args: { stripeInvoiceId: string; adjustmentId?: string }
): ResultAsync<InvoiceRequiredAdjustment, PackageAdjustmentInvoicePaymentClaimError> {
	if (args.adjustmentId) {
		const normalizedAdjustmentId = ctx.db.normalizeId("packageAdjustments", args.adjustmentId);

		if (!normalizedAdjustmentId) {
			return getPackageAdjustmentByStripeInvoiceId(ctx, args.stripeInvoiceId);
		}

		return getPackageAdjustmentInvoice(ctx, normalizedAdjustmentId);
	}

	return getPackageAdjustmentByStripeInvoiceId(ctx, args.stripeInvoiceId);
}

function requirePayableAdjustment(
	adjustment: InvoiceRequiredAdjustment,
	stripeInvoiceId: string
): Result<PayableAdjustmentDecision, PackageAdjustmentInvoicePaymentClaimError> {
	if (adjustment.paymentStatus === "paid") {
		return ok({ outcome: "already_completed" });
	}

	if (adjustment.invoiceEmailStatus !== "sent") {
		return err({ reason: "PACKAGE_ADJUSTMENT_INVOICE_NOT_SENT" });
	}

	if (adjustment.stripeInvoiceId !== stripeInvoiceId) {
		return err({ reason: "STRIPE_INVOICE_MISMATCH" });
	}

	return ok({ outcome: "ready", adjustment });
}

export function claimPackageAdjustmentInvoicePayment(
	ctx: MutationCtx,
	args: { stripeInvoiceId: string; adjustmentId?: string; paidAt: number }
): ResultAsync<PackageAdjustmentInvoicePaymentClaim, PackageAdjustmentInvoicePaymentClaimError> {
	return resolvePackageAdjustmentForPayment(ctx, args).andThen((adjustment) => {
		const paymentDecision = requirePayableAdjustment(adjustment, args.stripeInvoiceId);

		if (paymentDecision.isErr()) {
			return errAsync(paymentDecision.error);
		}

		if (paymentDecision.value.outcome === "already_completed") {
			return okAsync({ outcome: "already_completed" as const });
		}

		const payableAdjustment = paymentDecision.value.adjustment;

		return okOrThrow(
			ctx.db
				.patch(payableAdjustment._id, { paymentStatus: "paid", paidAt: args.paidAt })
				.then(() => ({
					outcome: "completed" as const,
					adjustmentId: payableAdjustment._id,
					packageId: payableAdjustment.packageId
				}))
		);
	});
}
