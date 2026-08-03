import { v } from "convex/values";
import { tupleErr, tupleOk } from "#/lib/result";
import type { Id } from "./_generated/dataModel";
import { internal } from "./_generated/api";
import { internalMutation, internalQuery, mutation, type MutationCtx } from "./_generated/server";
import {
	getSentPackageAdjustmentInvoice,
	PACKAGE_ADJUSTMENT_EMAIL_CLAIM_TIMEOUT_MS
} from "./lib/packageAdjustments";
import { getPackageFromDb } from "./lib/packageLookup";
import {
	claimPackageAdjustmentInvoiceEmailService,
	completePackageAdjustmentInvoiceEmailService,
	markPackageAdjustmentPaymentStatusService,
	markStalledPackageAdjustmentInvoiceEmailFailedService,
	type ClaimPackageAdjustmentInvoiceEmailArgs
} from "./services/packageAdjustments";

const adjustmentEmailAttemptValidator = v.union(v.literal("automatic"), v.literal("retry"));

export const getPackageAdjustmentInvoiceInput = internalQuery({
	args: { adjustmentId: v.id("packageAdjustments") },
	handler: (ctx, args) =>
		getSentPackageAdjustmentInvoice(ctx, args.adjustmentId)
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

function claimPackageAdjustmentInvoiceEmailHandler(
	ctx: MutationCtx,
	args: ClaimPackageAdjustmentInvoiceEmailArgs
) {
	return claimPackageAdjustmentInvoiceEmailService(
		ctx,
		args,
		(): Promise<unknown> =>
			ctx.scheduler.runAfter(
				PACKAGE_ADJUSTMENT_EMAIL_CLAIM_TIMEOUT_MS,
				internal.packageAdjustments.markStalledPackageAdjustmentInvoiceEmailFailed,
				{ adjustmentId: args.adjustmentId, claimedAt: args.now }
			)
	).match(tupleOk, tupleErr);
}

export const markStalledPackageAdjustmentInvoiceEmailFailed = internalMutation({
	args: { adjustmentId: v.id("packageAdjustments"), claimedAt: v.number() },
	handler: (ctx, args) => markStalledPackageAdjustmentInvoiceEmailFailedHandler(ctx, args)
});

function markStalledPackageAdjustmentInvoiceEmailFailedHandler(
	ctx: MutationCtx,
	args: { adjustmentId: Id<"packageAdjustments">; claimedAt: number }
) {
	return markStalledPackageAdjustmentInvoiceEmailFailedService(ctx, args).match(tupleOk, tupleErr);
}

export const markPackageAdjustmentInvoiceEmailSent = internalMutation({
	args: { adjustmentId: v.id("packageAdjustments"), claimedAt: v.number() },
	handler: (ctx, args) => markPackageAdjustmentInvoiceEmailSentHandler(ctx, args)
});

function markPackageAdjustmentInvoiceEmailSentHandler(
	ctx: MutationCtx,
	args: { adjustmentId: Id<"packageAdjustments">; claimedAt: number }
) {
	return completePackageAdjustmentInvoiceEmailService(ctx, args, "sent").match(tupleOk, tupleErr);
}

export const markPackageAdjustmentInvoiceEmailFailed = internalMutation({
	args: { adjustmentId: v.id("packageAdjustments"), claimedAt: v.number() },
	handler: (ctx, args) => markPackageAdjustmentInvoiceEmailFailedHandler(ctx, args)
});

function markPackageAdjustmentInvoiceEmailFailedHandler(
	ctx: MutationCtx,
	args: { adjustmentId: Id<"packageAdjustments">; claimedAt: number }
) {
	return completePackageAdjustmentInvoiceEmailService(ctx, args, "failed").match(tupleOk, tupleErr);
}

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
