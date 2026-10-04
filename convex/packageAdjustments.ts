import { v } from "convex/values";
import { tupleErr, tupleOk } from "#/lib/result";
import { internal } from "#convex/_generated/api";
import type { Id } from "#convex/_generated/dataModel";
import { internalMutation, mutation } from "#convex/_generated/server";
import { PACKAGE_ADJUSTMENT_EMAIL_CLAIM_TIMEOUT_MS } from "#convex/lib/packages/packageAdjustments";
import {
	claimPackageAdjustmentInvoiceEmailService,
	claimPackageAdjustmentInvoicePaymentService,
	completePackageAdjustmentInvoiceEmailFailedService,
	completePackageAdjustmentInvoiceEmailSentService,
	markPackageAdjustmentPaymentStatusService,
	markStalledPackageAdjustmentInvoiceEmailFailedService
} from "#convex/services/packages/packageAdjustments";

const adjustmentEmailAttemptValidator = v.union(v.literal("automatic"), v.literal("retry"));

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
			(): Promise<Id<"_scheduled_functions">> =>
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
	args: {
		adjustmentId: v.id("packageAdjustments"),
		claimedAt: v.number(),
		stripeInvoiceId: v.string()
	},
	handler: (ctx, args) =>
		completePackageAdjustmentInvoiceEmailSentService(ctx, args).match(tupleOk, tupleErr)
});

export const claimPackageAdjustmentInvoicePayment = internalMutation({
	args: { stripeInvoiceId: v.string(), adjustmentId: v.optional(v.string()), paidAt: v.number() },
	handler: (ctx, args) =>
		claimPackageAdjustmentInvoicePaymentService(ctx, args).match(tupleOk, tupleErr)
});

export const markPackageAdjustmentInvoiceEmailFailed = internalMutation({
	args: { adjustmentId: v.id("packageAdjustments"), claimedAt: v.number() },
	handler: (ctx, args) =>
		completePackageAdjustmentInvoiceEmailFailedService(ctx, args).match(tupleOk, tupleErr)
});

export const markPackageAdjustmentPaymentStatus = mutation({
	args: { adjustmentId: v.id("packageAdjustments"), paid: v.boolean() },
	handler: (ctx, args) =>
		markPackageAdjustmentPaymentStatusService(ctx, args).match(tupleOk, tupleErr)
});
