"use node";

import { v } from "convex/values";
import type { ResultAsync } from "neverthrow";
import { tupleErr, tupleOk } from "#/lib/result";
import type { Id } from "#convex/_generated/dataModel";
import { action, internalAction, type ActionCtx } from "#convex/_generated/server";
import { requirePermissionActions } from "#convex/shared/services/requirePermissionActions";
import {
	claimPackageAdjustmentInvoiceEmailForSend,
	createPackageAdjustmentInvoiceDraft,
	recordFailedPackageAdjustmentInvoice,
	recordSentPackageAdjustmentInvoice,
	sendPackageAdjustmentInvoiceDraft,
	type SendPackageAdjustmentInvoiceError
} from "#convex/packages/services/adjustmentInvoiceSend";

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
			createPackageAdjustmentInvoiceDraft(args.adjustmentId, invoiceInput)
				.andThen((invoice) => sendPackageAdjustmentInvoiceDraft(args.adjustmentId, invoice))
				.orElse((failure) => recordFailedPackageAdjustmentInvoice(ctx, args, failure))
				.andThen((invoice) =>
					recordSentPackageAdjustmentInvoice(ctx, args, args.claimedAt, invoice)
				)
	);
}
