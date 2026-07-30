import { v } from "convex/values";
import { err, err as tupleErr, ok, ok as tupleOk } from "#/lib/result";
import type { Id } from "./_generated/dataModel";
import { internal } from "./_generated/api";
import { internalMutation, internalQuery, mutation, type MutationCtx } from "./_generated/server";
import {
	getSentPackageAdjustmentInvoiceResult,
	PACKAGE_ADJUSTMENT_EMAIL_CLAIM_TIMEOUT_MS
} from "./lib/packageAdjustments";
import { getPackageFromDb } from "./lib/packageLookup";
import { markPackageAdjustmentPaymentStatusService } from "./services/packageAdjustments";

const adjustmentEmailAttemptValidator = v.union(v.literal("automatic"), v.literal("retry"));

export const getPackageAdjustmentInvoiceSource = internalQuery({
	args: { adjustmentId: v.id("packageAdjustments") },
	handler: (ctx, args) =>
		getSentPackageAdjustmentInvoiceResult(ctx, args.adjustmentId)
			.andThen((adjustment) =>
				getPackageFromDb(ctx, adjustment.multiBookingId)
					.map((multiBooking) => ({ adjustment, multiBooking }))
					.mapErr(() => ({ reason: "PACKAGE_ADJUSTMENT_NOT_FOUND" as const }))
			)
			.match(tupleOk, tupleErr)
});

export const claimPackageAdjustmentInvoiceEmail = internalMutation({
	args: {
		adjustmentId: v.id("packageAdjustments"),
		attempt: adjustmentEmailAttemptValidator,
		now: v.number()
	},
	handler: (ctx, args) => claimPackageAdjustmentInvoiceEmailHandler(ctx, args)
});

async function claimPackageAdjustmentInvoiceEmailHandler(
	ctx: MutationCtx,
	args: { adjustmentId: Id<"packageAdjustments">; attempt: "automatic" | "retry"; now: number }
) {
	const adjustment = await ctx.db.get(args.adjustmentId);

	if (!adjustment || adjustment.outcome !== "invoice_required") {
		return err({ reason: "PACKAGE_ADJUSTMENT_NOT_FOUND" });
	}

	if (adjustment.invoiceEmailStatus === "sent") {
		return err({ reason: "PACKAGE_ADJUSTMENT_EMAIL_NOT_SENDABLE" });
	}

	const isEmailSendInProgress =
		adjustment.invoiceEmailClaimedAt !== undefined &&
		args.now - adjustment.invoiceEmailClaimedAt < PACKAGE_ADJUSTMENT_EMAIL_CLAIM_TIMEOUT_MS;

	if (isEmailSendInProgress) {
		return err({ reason: "PACKAGE_ADJUSTMENT_EMAIL_NOT_SENDABLE" });
	}

	const expectedStatus = args.attempt === "automatic" ? "pending" : "failed";

	if (adjustment.invoiceEmailStatus !== expectedStatus) {
		return err({ reason: "PACKAGE_ADJUSTMENT_EMAIL_NOT_SENDABLE" });
	}

	const multiBooking = await ctx.db.get(adjustment.multiBookingId);

	if (!multiBooking) {
		return err({ reason: "PACKAGE_NOT_FOUND" });
	}

	await ctx.db.patch(adjustment._id, { invoiceEmailClaimedAt: args.now });
	await ctx.scheduler.runAfter(
		PACKAGE_ADJUSTMENT_EMAIL_CLAIM_TIMEOUT_MS,
		internal.packageAdjustments.markStalledPackageAdjustmentInvoiceEmailFailed,
		{ adjustmentId: adjustment._id, claimedAt: args.now }
	);

	return ok({ adjustment, multiBooking });
}

export const markStalledPackageAdjustmentInvoiceEmailFailed = internalMutation({
	args: { adjustmentId: v.id("packageAdjustments"), claimedAt: v.number() },
	handler: async (ctx, args) => {
		const adjustment = await ctx.db.get(args.adjustmentId);

		if (
			!adjustment ||
			adjustment.outcome !== "invoice_required" ||
			adjustment.invoiceEmailStatus !== "pending" ||
			adjustment.invoiceEmailClaimedAt !== args.claimedAt
		) {
			return null;
		}

		await ctx.db.patch(adjustment._id, {
			invoiceEmailStatus: "failed",
			invoiceEmailClaimedAt: undefined
		});
		return null;
	}
});

export const markPackageAdjustmentInvoiceEmailSent = internalMutation({
	args: { adjustmentId: v.id("packageAdjustments"), claimedAt: v.number() },
	handler: async (ctx, args) => {
		const adjustment = await ctx.db.get(args.adjustmentId);

		if (!adjustment || adjustment.outcome !== "invoice_required") {
			return err({ reason: "PACKAGE_ADJUSTMENT_NOT_FOUND" });
		}

		// Ignore completion from a timed-out attempt after a newer retry has claimed the email.
		if (adjustment.invoiceEmailClaimedAt !== args.claimedAt) {
			return ok({ updated: false });
		}

		await ctx.db.patch(adjustment._id, {
			invoiceEmailStatus: "sent",
			invoiceEmailClaimedAt: undefined
		});

		return ok({ updated: true });
	}
});

export const markPackageAdjustmentInvoiceEmailFailed = internalMutation({
	args: { adjustmentId: v.id("packageAdjustments"), claimedAt: v.number() },
	handler: async (ctx, args) => {
		const adjustment = await ctx.db.get(args.adjustmentId);

		if (!adjustment || adjustment.outcome !== "invoice_required") {
			return err({ reason: "PACKAGE_ADJUSTMENT_NOT_FOUND" });
		}

		// Ignore completion from a timed-out attempt after a newer retry has claimed the email.
		if (adjustment.invoiceEmailClaimedAt !== args.claimedAt) {
			return ok({ updated: false });
		}

		await ctx.db.patch(adjustment._id, {
			invoiceEmailStatus: "failed",
			invoiceEmailClaimedAt: undefined
		});

		return ok({ updated: true });
	}
});

export const markPackageAdjustmentPaymentStatus = mutation({
	args: { adjustmentId: v.id("packageAdjustments"), paid: v.boolean() },
	handler: (ctx, args) => markPackageAdjustmentPaymentStatusHandler(ctx, args)
});

function markPackageAdjustmentPaymentStatusHandler(
	ctx: MutationCtx,
	args: { adjustmentId: Id<"packageAdjustments">; paid: boolean }
) {
	return markPackageAdjustmentPaymentStatusService(ctx, args).match(tupleOk, tupleErr);
}

export type MarkPackageAdjustmentPaymentStatusResult = Awaited<
	ReturnType<typeof markPackageAdjustmentPaymentStatusHandler>
>;
