import { v } from "convex/values";
import { tupleErr, tupleOk } from "#/lib/result";
import { internalMutation, mutation } from "#convex/_generated/server";
import {
	claimPackageAdjustmentInvoiceEmail as claimPackageAdjustmentInvoiceEmailStep,
	claimPackageAdjustmentInvoicePaymentAndArchive,
	markStalledPackageAdjustmentInvoiceEmailFailed as markStalledPackageAdjustmentInvoiceEmailFailedStep,
	updatePackageAdjustmentPaymentStatusFromAdmin,
	writePackageAdjustmentInvoiceEmailFailed,
	writePackageAdjustmentInvoiceEmailSent
} from "#convex/services/packages/packageAdjustmentInvoiceEmailWorkflow";

const adjustmentEmailAttemptValidator = v.union(v.literal("automatic"), v.literal("retry"));

export const claimPackageAdjustmentInvoiceEmail = internalMutation({
	args: {
		adjustmentId: v.id("packageAdjustments"),
		attempt: adjustmentEmailAttemptValidator,
		now: v.number()
	},
	handler: (ctx, args) => claimPackageAdjustmentInvoiceEmailStep(ctx, args).match(tupleOk, tupleErr)
});

export const markStalledPackageAdjustmentInvoiceEmailFailed = internalMutation({
	args: { adjustmentId: v.id("packageAdjustments"), claimedAt: v.number() },
	handler: (ctx, args) =>
		markStalledPackageAdjustmentInvoiceEmailFailedStep(ctx, args).match(tupleOk, tupleErr)
});

export const markPackageAdjustmentInvoiceEmailSent = internalMutation({
	args: {
		adjustmentId: v.id("packageAdjustments"),
		claimedAt: v.number(),
		stripeInvoiceId: v.string()
	},
	handler: (ctx, args) => writePackageAdjustmentInvoiceEmailSent(ctx, args).match(tupleOk, tupleErr)
});

export const claimPackageAdjustmentInvoicePayment = internalMutation({
	args: { stripeInvoiceId: v.string(), adjustmentId: v.optional(v.string()), paidAt: v.number() },
	handler: (ctx, args) =>
		claimPackageAdjustmentInvoicePaymentAndArchive(ctx, args).match(tupleOk, tupleErr)
});

export const markPackageAdjustmentInvoiceEmailFailed = internalMutation({
	args: { adjustmentId: v.id("packageAdjustments"), claimedAt: v.number() },
	handler: (ctx, args) =>
		writePackageAdjustmentInvoiceEmailFailed(ctx, args).match(tupleOk, tupleErr)
});

export const markPackageAdjustmentPaymentStatus = mutation({
	args: { adjustmentId: v.id("packageAdjustments"), paid: v.boolean() },
	handler: (ctx, args) =>
		updatePackageAdjustmentPaymentStatusFromAdmin(ctx, args).match(tupleOk, tupleErr)
});
