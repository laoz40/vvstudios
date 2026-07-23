"use node";

import { v } from "convex/values";
import { err, ok, type Result } from "../src/lib/result";
import type { Id } from "./_generated/dataModel";
import { internal } from "./_generated/api";
import { action, internalAction, type ActionCtx } from "./_generated/server";
import {
	createPackageAdjustmentInvoiceArtifacts,
	renderBookingInvoicePdfInNode,
	type PackageAdjustmentInvoiceSource
} from "./lib/bookingInvoiceArtifacts";
import { getAdminIdentity } from "./lib/auth";
import { sendPackageAdjustmentInvoiceEmail } from "./lib/email";

type PackageAdjustmentEmailClaimError =
	| { reason: "PACKAGE_ADJUSTMENT_NOT_FOUND" }
	| { reason: "PACKAGE_ADJUSTMENT_EMAIL_NOT_SENDABLE" }
	| { reason: "PACKAGE_NOT_FOUND" };

type SendPackageAdjustmentInvoiceResult = Result<
	{ sent: true },
	PackageAdjustmentEmailClaimError | { reason: "PACKAGE_ADJUSTMENT_INVOICE_EMAIL_FAILED" }
>;

type RetryPackageAdjustmentInvoiceError =
	| PackageAdjustmentEmailClaimError
	| { reason: "PACKAGE_ADJUSTMENT_INVOICE_EMAIL_FAILED" }
	| { reason: "NOT_AUTHENTICATED" }
	| { reason: "NOT_AUTHORIZED" };

export type RetryPackageAdjustmentInvoiceEmailResult = Result<
	{ sent: true },
	RetryPackageAdjustmentInvoiceError
>;

export const sendPackageAdjustmentInvoice = internalAction({
	args: {
		adjustmentId: v.id("packageAdjustments"),
		attempt: v.union(v.literal("automatic"), v.literal("retry"))
	},
	handler: (ctx, args) => sendPackageAdjustmentInvoiceHandler(ctx, args)
});

export const retryPackageAdjustmentInvoiceEmail = action({
	args: { adjustmentId: v.id("packageAdjustments") },
	handler: async (ctx, args): Promise<RetryPackageAdjustmentInvoiceEmailResult> => {
		const [authError] = await getAdminIdentity(ctx);

		if (authError !== null) {
			return err(authError);
		}

		return sendPackageAdjustmentInvoiceHandler(ctx, { ...args, attempt: "retry" });
	}
});

async function sendPackageAdjustmentInvoiceHandler(
	ctx: ActionCtx,
	args: { adjustmentId: Id<"packageAdjustments">; attempt: "automatic" | "retry" }
): Promise<SendPackageAdjustmentInvoiceResult> {
	const claimedAt = Date.now();
	const [claimError, source]: Result<
		PackageAdjustmentInvoiceSource,
		PackageAdjustmentEmailClaimError
	> = await ctx.runMutation(internal.packageAdjustments.claimPackageAdjustmentInvoiceEmail, {
		adjustmentId: args.adjustmentId,
		attempt: args.attempt,
		now: claimedAt
	});

	if (claimError !== null) {
		return err(claimError);
	}

	const [emailError] = await sendPackageAdjustmentInvoiceEmail(source);

	if (emailError !== null) {
		await ctx.runMutation(internal.packageAdjustments.markPackageAdjustmentInvoiceEmailFailed, {
			adjustmentId: args.adjustmentId,
			claimedAt
		});
		return err({ reason: "PACKAGE_ADJUSTMENT_INVOICE_EMAIL_FAILED" });
	}

	await ctx.runMutation(internal.packageAdjustments.markPackageAdjustmentInvoiceEmailSent, {
		adjustmentId: args.adjustmentId,
		claimedAt
	});

	return ok({ sent: true });
}

export const getAdminPackageAdjustmentInvoicePdf = action({
	args: { adjustmentId: v.id("packageAdjustments") },
	handler: (ctx, args) => getAdminPackageAdjustmentInvoicePdfHandler(ctx, args)
});

async function getAdminPackageAdjustmentInvoicePdfHandler(
	ctx: ActionCtx,
	args: { adjustmentId: Id<"packageAdjustments"> }
) {
	const [authError] = await getAdminIdentity(ctx);

	if (authError !== null) {
		return err(authError);
	}

	const source = await ctx.runQuery(
		internal.packageAdjustments.getPackageAdjustmentInvoiceSource,
		args
	);

	if (!source) {
		return err({ reason: "PACKAGE_ADJUSTMENT_NOT_FOUND" });
	}

	if (source.adjustment.invoiceEmailStatus !== "sent") {
		return err({ reason: "PACKAGE_ADJUSTMENT_INVOICE_NOT_SENT" });
	}

	const [artifactsError, artifactsResult] = await createPackageAdjustmentInvoiceArtifacts(source);

	if (artifactsError !== null) {
		return err(artifactsError);
	}

	const [pdfError, pdfContent] = await renderBookingInvoicePdfInNode(
		artifactsResult.artifacts.data
	);

	if (pdfError !== null) {
		return err({ reason: "INVOICE_DOWNLOAD_FAILED" });
	}

	return ok({
		content: pdfContent.buffer.slice(
			pdfContent.byteOffset,
			pdfContent.byteOffset + pdfContent.byteLength
		),
		contentType: artifactsResult.artifacts.pdf.contentType,
		filename: artifactsResult.artifacts.pdf.filename
	});
}

export type GetAdminPackageAdjustmentInvoicePdfResult = Awaited<
	ReturnType<typeof getAdminPackageAdjustmentInvoicePdfHandler>
>;
