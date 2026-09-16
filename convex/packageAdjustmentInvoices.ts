"use node";

import { v } from "convex/values";
import { tupleErr, tupleOk } from "#/lib/result";
import type { Id } from "#convex/_generated/dataModel";
import { action, internalAction, type ActionCtx } from "#convex/_generated/server";
import {
	retryPackageAdjustmentInvoiceEmailService,
	sendPackageAdjustmentInvoiceService
} from "#convex/services/packageAdjustmentInvoices";

export const sendPackageAdjustmentInvoice = internalAction({
	args: {
		adjustmentId: v.id("packageAdjustments"),
		attempt: v.union(v.literal("automatic"), v.literal("retry"))
	},
	handler: (ctx, args) => sendPackageAdjustmentInvoiceHandler(ctx, args)
});

function sendPackageAdjustmentInvoiceHandler(
	ctx: ActionCtx,
	args: { adjustmentId: Id<"packageAdjustments">; attempt: "automatic" | "retry" }
) {
	return sendPackageAdjustmentInvoiceService(ctx, args).match(tupleOk, tupleErr);
}

export const retryPackageAdjustmentInvoiceEmail = action({
	args: { adjustmentId: v.id("packageAdjustments") },
	handler: (ctx, args) => retryPackageAdjustmentInvoiceEmailHandler(ctx, args)
});

function retryPackageAdjustmentInvoiceEmailHandler(
	ctx: ActionCtx,
	args: { adjustmentId: Id<"packageAdjustments"> }
) {
	return retryPackageAdjustmentInvoiceEmailService(ctx, args).match(tupleOk, tupleErr);
}

export type RetryPackageAdjustmentInvoiceEmailResult = Awaited<
	ReturnType<typeof retryPackageAdjustmentInvoiceEmailHandler>
>;
