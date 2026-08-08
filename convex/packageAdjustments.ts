import { v } from "convex/values";
import { tupleErr, tupleOk } from "#/lib/result";
import { internal } from "#convex/_generated/api";
import { internalMutation, internalQuery, mutation } from "#convex/_generated/server";
import { PACKAGE_ADJUSTMENT_EMAIL_CLAIM_TIMEOUT_MS } from "#convex/lib/packageAdjustments";
import {
	claimPackageAdjustmentInvoiceEmailService,
	completePackageAdjustmentInvoiceEmailService,
	getPackageAdjustmentInvoiceInputService,
	markPackageAdjustmentPaymentStatusService,
	markStalledPackageAdjustmentInvoiceEmailFailedService
} from "#convex/services/packageAdjustments";

const adjustmentEmailAttemptValidator = v.union(v.literal("automatic"), v.literal("retry"));

export const getPackageAdjustmentInvoiceInput = internalQuery({
	args: { adjustmentId: v.id("packageAdjustments") },
	handler: (ctx, args) =>
		getPackageAdjustmentInvoiceInputService(ctx, args).match(tupleOk, tupleErr)
});

export const claimPackageAdjustmentInvoiceEmail = internalMutation({
	args: {
		adjustmentId: v.id("packageAdjustments"),
		attempt: adjustmentEmailAttemptValidator,
		now: v.number()
	},
	handler: (ctx, args) =>
		claimPackageAdjustmentInvoiceEmailService(
			ctx,
			args,
			(): Promise<unknown> =>
				ctx.scheduler.runAfter(
					PACKAGE_ADJUSTMENT_EMAIL_CLAIM_TIMEOUT_MS,
					internal.packageAdjustments.markStalledPackageAdjustmentInvoiceEmailFailed,
					{ adjustmentId: args.adjustmentId, claimedAt: args.now }
				)
		).match(tupleOk, tupleErr)
});

export const markStalledPackageAdjustmentInvoiceEmailFailed = internalMutation({
	args: { adjustmentId: v.id("packageAdjustments"), claimedAt: v.number() },
	handler: (ctx, args) =>
		markStalledPackageAdjustmentInvoiceEmailFailedService(ctx, args).match(tupleOk, tupleErr)
});

export const markPackageAdjustmentInvoiceEmailSent = internalMutation({
	args: { adjustmentId: v.id("packageAdjustments"), claimedAt: v.number() },
	handler: (ctx, args) =>
		completePackageAdjustmentInvoiceEmailService(ctx, args, "sent").match(tupleOk, tupleErr)
});

export const markPackageAdjustmentInvoiceEmailFailed = internalMutation({
	args: { adjustmentId: v.id("packageAdjustments"), claimedAt: v.number() },
	handler: (ctx, args) =>
		completePackageAdjustmentInvoiceEmailService(ctx, args, "failed").match(tupleOk, tupleErr)
});

export const markPackageAdjustmentPaymentStatus = mutation({
	args: { adjustmentId: v.id("packageAdjustments"), paid: v.boolean() },
	handler: (ctx, args) =>
		markPackageAdjustmentPaymentStatusService(ctx, args).match(tupleOk, tupleErr)
});
