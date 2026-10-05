"use node";

import { v } from "convex/values";
import type { ResultAsync } from "neverthrow";
import { tupleErr, tupleOk } from "#/lib/result";
import type { Id } from "#convex/_generated/dataModel";
import { action, internalAction, type ActionCtx } from "#convex/_generated/server";
import { requirePermissionActions } from "#convex/services/requirePermissionActions";
import {
	claimPackageAdjustmentInvoiceEmailForSend,
	createSendAndRecordPackageAdjustmentInvoice,
	type SendPackageAdjustmentInvoiceError
} from "#convex/services/packages/packageAdjustmentInvoiceSend";

export const sendPackageAdjustmentInvoice = internalAction({
	args: {
		adjustmentId: v.id("packageAdjustments"),
		attempt: v.union(v.literal("automatic"), v.literal("retry"))
	},
	handler: (ctx, args) => {
		const claimedAt = Date.now();

		return sendPackageAdjustmentInvoiceHandler(ctx, { ...args, claimedAt }).match(
			tupleOk,
			tupleErr
		);
	}
});

export const retryPackageAdjustmentInvoiceEmail = action({
	args: { adjustmentId: v.id("packageAdjustments") },
	handler: (ctx, args) =>
		requirePermissionActions(ctx, "send:receipt-emails")
			.andThen(() =>
				sendPackageAdjustmentInvoiceHandler(ctx, {
					adjustmentId: args.adjustmentId,
					attempt: "retry",
					claimedAt: Date.now()
				})
			)
			.match(tupleOk, tupleErr)
});

function sendPackageAdjustmentInvoiceHandler(
	ctx: ActionCtx,
	args: {
		adjustmentId: Id<"packageAdjustments">;
		attempt: "automatic" | "retry";
		claimedAt: number;
	}
): ResultAsync<null, SendPackageAdjustmentInvoiceError> {
	return claimPackageAdjustmentInvoiceEmailForSend(ctx, args, args.claimedAt).andThen(
		(invoiceInput) =>
			createSendAndRecordPackageAdjustmentInvoice(ctx, args, args.claimedAt, invoiceInput)
	);
}
