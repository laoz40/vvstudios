import { err, ok, type Result } from "neverthrow";
import type { Doc, Id } from "#convex/_generated/dataModel";
import type { MutationCtx, QueryCtx } from "#convex/_generated/server";
import { okOrThrow } from "#convex/shared/lib/result";

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

export function getPackageAdjustmentByStripeInvoiceId(
	ctx: QueryCtx | MutationCtx,
	stripeInvoiceId: string
) {
	return okOrThrow(
		ctx.db
			.query("packageAdjustments")
			.withIndex("by_stripeInvoiceId", (indexQuery) =>
				indexQuery.eq("stripeInvoiceId", stripeInvoiceId)
			)
			.unique()
	);
}

export function normalizePackageAdjustmentId(ctx: MutationCtx, adjustmentId: string) {
	return ctx.db.normalizeId("packageAdjustments", adjustmentId);
}

export function requireInvoiceRequiredAdjustment(
	adjustment: Doc<"packageAdjustments"> | null
): Result<InvoiceRequiredAdjustment, PackageAdjustmentInvoicePaymentClaimError> {
	if (!adjustment || adjustment.outcome !== "invoice_required") {
		return err({ reason: "PACKAGE_ADJUSTMENT_NOT_FOUND" });
	}

	return ok(adjustment);
}

export function requirePayableAdjustment(
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

export function markPackageAdjustmentInvoicePaid(
	ctx: MutationCtx,
	adjustment: InvoiceRequiredAdjustment,
	paidAt: number
) {
	return okOrThrow(
		ctx.db
			.patch("packageAdjustments", adjustment._id, { paymentStatus: "paid", paidAt })
			.then(() => ({
				outcome: "completed" as const,
				adjustmentId: adjustment._id,
				packageId: adjustment.packageId
			}))
	);
}
