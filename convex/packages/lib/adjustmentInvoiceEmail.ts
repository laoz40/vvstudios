import { errAsync, ok, okAsync } from "neverthrow";
import type { Doc, Id } from "#convex/_generated/dataModel";
import { internal } from "#convex/_generated/api";
import type { MutationCtx, QueryCtx } from "#convex/_generated/server";
import { okOrThrow } from "#convex/shared/lib/result";
import {
	PACKAGE_ADJUSTMENT_EMAIL_CLAIM_TIMEOUT_MS,
	patchPackageAdjustmentInvoiceEmailFailed
} from "#convex/packages/lib/adjustments";
import {
	markPackageAdjustmentInvoicePaid,
	requirePayableAdjustment
} from "#convex/packages/lib/adjustmentInvoicePayment";
import { getCustomerAddonDisplayLabel } from "#/domain/booking/catalog";

type InvoiceAdjustment = Extract<Doc<"packageAdjustments">, { outcome: "invoice_required" }>;

export function selectAdjustmentEmailsForClaim(adjustment: InvoiceAdjustment, claimedAt: number) {
	return adjustment.invoiceEmailClaimedAt === claimedAt ? [adjustment] : [];
}

export function patchStalledAdjustmentEmail(
	ctx: MutationCtx,
	adjustment: InvoiceAdjustment | null,
	claimedAt: number
) {
	if (
		!adjustment ||
		adjustment.invoiceEmailStatus !== "pending" ||
		adjustment.invoiceEmailClaimedAt !== claimedAt
	) {
		return ok(null);
	}

	return patchPackageAdjustmentInvoiceEmailFailed(ctx, adjustment._id);
}

export function scheduleStalledAdjustmentEmailFailure(
	ctx: MutationCtx,
	adjustmentId: Id<"packageAdjustments">,
	claimedAt: number
) {
	return okOrThrow(
		ctx.scheduler.runAfter(
			PACKAGE_ADJUSTMENT_EMAIL_CLAIM_TIMEOUT_MS,
			internal.packages.adjustments.markStalledPackageAdjustmentInvoiceEmailFailed,
			{ adjustmentId, claimedAt }
		)
	);
}

export function adjustmentStripeInvoiceRecordArgs(
	adjustment: InvoiceAdjustment,
	stripeInvoiceId: string
) {
	return {
		packageId: adjustment.packageId,
		packageAdjustmentId: adjustment._id,
		stripeInvoiceId,
		lineItems: [
			{
				description: `${getCustomerAddonDisplayLabel("Remote Podcast")} (package adjustment)`,
				amount: adjustment.totalAmount
			}
		],
		totalAmount: adjustment.totalAmount
	};
}

export function claimPackageAdjustmentPayment(
	ctx: MutationCtx,
	args: { stripeInvoiceId: string; paidAt: number },
	adjustment: InvoiceAdjustment
) {
	const decision = requirePayableAdjustment(adjustment, args.stripeInvoiceId);

	if (decision.isErr()) return errAsync(decision.error);

	if (decision.value.outcome === "already_completed") {
		return okAsync({ outcome: "already_completed" as const });
	}

	return markPackageAdjustmentInvoicePaid(ctx, decision.value.adjustment, args.paidAt);
}

export function lookupPackageAdjustmentForPayment(
	ctx: QueryCtx | MutationCtx,
	args: { stripeInvoiceId: string; adjustmentId?: string }
) {
	const adjustmentId = args.adjustmentId
		? ctx.db.normalizeId("packageAdjustments", args.adjustmentId)
		: null;

	if (adjustmentId) return okOrThrow(ctx.db.get("packageAdjustments", adjustmentId));

	return okOrThrow(
		ctx.db
			.query("packageAdjustments")
			.withIndex("by_stripeInvoiceId", (query) => query.eq("stripeInvoiceId", args.stripeInvoiceId))
			.unique()
	);
}

export function patchClaimedAdjustmentEmailFailure(
	ctx: MutationCtx,
	adjustment: InvoiceAdjustment,
	claimedAt: number
) {
	if (adjustment.invoiceEmailClaimedAt !== claimedAt) return okAsync({ updated: false });

	return patchPackageAdjustmentInvoiceEmailFailed(ctx, adjustment._id).map(() => ({
		updated: true
	}));
}
