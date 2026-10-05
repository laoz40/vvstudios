"use node";

import { v } from "convex/values";
import { tupleErr, tupleOk } from "#/lib/result";
import type { Id } from "#convex/_generated/dataModel";
import { action, internalAction, type ActionCtx } from "#convex/_generated/server";
import { requirePermissionActions } from "#convex/services/auth";
import {
	claimPackageAdjustmentInvoiceEmailForSend,
	createSendAndRecordPackageAdjustmentInvoice
} from "#convex/services/packages/packageAdjustmentInvoiceSendWorkflow";

export const sendPackageAdjustmentInvoice = internalAction({
	args: {
		adjustmentId: v.id("packageAdjustments"),
		attempt: v.union(v.literal("automatic"), v.literal("retry"))
	},
	handler: async (ctx, args) => {
		const claimedAt = Date.now();

		return await sendPackageAdjustmentInvoiceHandler(ctx, { ...args, claimedAt }).match(
			tupleOk,
			tupleErr
		);
	}
});

export const retryPackageAdjustmentInvoiceEmail = action({
	args: { adjustmentId: v.id("packageAdjustments") },
	handler: async (ctx, args) =>
		await requirePermissionActions(ctx, "send:receipt-emails")
			.andThen(() =>
				sendPackageAdjustmentInvoiceHandler(ctx, {
					adjustmentId: args.adjustmentId,
					attempt: "retry",
					claimedAt: Date.now()
				})
			)
			.match(tupleOk, tupleErr)
});

async function sendPackageAdjustmentInvoiceHandler(
	ctx: ActionCtx,
	args: {
		adjustmentId: Id<"packageAdjustments">;
		attempt: "automatic" | "retry";
		claimedAt: number;
	}
) {
	return claimPackageAdjustmentInvoiceEmailForSend(ctx, args, args.claimedAt).andThen(
		(invoiceInput) =>
			createSendAndRecordPackageAdjustmentInvoice(ctx, args, args.claimedAt, invoiceInput)
	);
}
