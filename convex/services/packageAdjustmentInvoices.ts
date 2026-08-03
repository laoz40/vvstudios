"use node";

import { err, ok, ResultAsync, type ResultAsync as NeverthrowResultAsync } from "neverthrow";
import type { Result as ConvexResult } from "#/lib/result";
import { internal } from "#convex/_generated/api";
import type { Id } from "#convex/_generated/dataModel";
import type { ActionCtx } from "#convex/_generated/server";
import { getAdminIdentityResult } from "#convex/lib/auth";
import {
	createPackageAdjustmentInvoiceArtifacts,
	renderBookingInvoicePdfInNode,
	type PackageAdjustmentInvoiceInput
} from "#convex/lib/bookingInvoiceArtifacts";
import { sendPackageAdjustmentInvoiceEmail } from "#convex/lib/email";
import { fromConvexResult } from "#convex/lib/result";

export type SendPackageAdjustmentInvoiceArgs = {
	adjustmentId: Id<"packageAdjustments">;
	attempt: "automatic" | "retry";
};

type PackageAdjustmentClaimError =
	| { reason: "PACKAGE_ADJUSTMENT_NOT_FOUND" }
	| { reason: "PACKAGE_ADJUSTMENT_EMAIL_NOT_SENDABLE" }
	| { reason: "PACKAGE_NOT_FOUND" };
type SendPackageAdjustmentInvoiceError =
	| PackageAdjustmentClaimError
	| { reason: "PACKAGE_ADJUSTMENT_INVOICE_EMAIL_FAILED" };
type PackageAdjustmentInvoicePdfError =
	| { reason: "NOT_AUTHENTICATED" }
	| { reason: "NOT_AUTHORIZED" }
	| { reason: "PACKAGE_ADJUSTMENT_NOT_FOUND" }
	| { reason: "PACKAGE_ADJUSTMENT_INVOICE_NOT_SENT" }
	| { reason: "INVALID_BOOKING_DATA" }
	| { reason: "INVOICE_EMAIL_RENDER_FAILED" }
	| { reason: "INVOICE_DOWNLOAD_FAILED" };
type PackageAdjustmentInvoiceInputQueryResult = Promise<
	ConvexResult<
		PackageAdjustmentInvoiceInput,
		{ reason: "PACKAGE_ADJUSTMENT_NOT_FOUND" } | { reason: "PACKAGE_ADJUSTMENT_INVOICE_NOT_SENT" }
	>
>;
type InvoicePdfPayload = { content: ArrayBuffer; contentType: string; filename: string };

function markPackageAdjustmentInvoiceEmailFailed(
	ctx: ActionCtx,
	args: { adjustmentId: Id<"packageAdjustments">; claimedAt: number }
): NeverthrowResultAsync<never, { reason: "PACKAGE_ADJUSTMENT_INVOICE_EMAIL_FAILED" }> {
	return fromConvexResult<Promise<ConvexResult<{ updated: boolean }, { reason: string }>>>(
		ctx.runMutation(internal.packageAdjustments.markPackageAdjustmentInvoiceEmailFailed, args)
	)
		.orElse(() => ok(null))
		.andThen(() => err({ reason: "PACKAGE_ADJUSTMENT_INVOICE_EMAIL_FAILED" as const }));
}

export function sendPackageAdjustmentInvoiceService(
	ctx: ActionCtx,
	args: SendPackageAdjustmentInvoiceArgs
): NeverthrowResultAsync<null, SendPackageAdjustmentInvoiceError> {
	const claimedAt = Date.now();
	return (
		fromConvexResult<
			Promise<ConvexResult<PackageAdjustmentInvoiceInput, PackageAdjustmentClaimError>>
		>(
			ctx.runMutation(internal.packageAdjustments.claimPackageAdjustmentInvoiceEmail, {
				adjustmentId: args.adjustmentId,
				attempt: args.attempt,
				now: claimedAt
			})
		)
			// Deliver the claimed invoice using its stored package and adjustment snapshot.
			.andThen((invoiceInput) =>
				ResultAsync.fromSafePromise(sendPackageAdjustmentInvoiceEmail(invoiceInput))
					.andThen((emailResult) => emailResult)
					.mapErr(() => ({ reason: "PACKAGE_ADJUSTMENT_INVOICE_EMAIL_FAILED" as const }))
					// Persist provider or render failure so an administrator can retry the invoice.
					.orElse(() =>
						markPackageAdjustmentInvoiceEmailFailed(ctx, {
							adjustmentId: args.adjustmentId,
							claimedAt
						})
					)
			)
			// Mark successful delivery only if this attempt still owns the claim.
			.andThen(() =>
				fromConvexResult<
					Promise<ConvexResult<{ updated: boolean }, { reason: "PACKAGE_ADJUSTMENT_NOT_FOUND" }>>
				>(
					ctx.runMutation(internal.packageAdjustments.markPackageAdjustmentInvoiceEmailSent, {
						adjustmentId: args.adjustmentId,
						claimedAt
					})
				)
					.orElse(() => ok(null))
					.map(() => null)
			)
	);
}

export function retryPackageAdjustmentInvoiceEmailService(
	ctx: ActionCtx,
	args: { adjustmentId: Id<"packageAdjustments"> }
): NeverthrowResultAsync<
	null,
	SendPackageAdjustmentInvoiceError | { reason: "NOT_AUTHENTICATED" } | { reason: "NOT_AUTHORIZED" }
> {
	return getAdminIdentityResult(ctx).andThen(() =>
		sendPackageAdjustmentInvoiceService(ctx, { ...args, attempt: "retry" })
	);
}

export function getAdminPackageAdjustmentInvoicePdfService(
	ctx: ActionCtx,
	args: { adjustmentId: Id<"packageAdjustments"> }
): NeverthrowResultAsync<InvoicePdfPayload, PackageAdjustmentInvoicePdfError> {
	return (
		getAdminIdentityResult(ctx)
			// Load the sent adjustment invoice input only after admin authorization succeeds.
			.andThen(() =>
				fromConvexResult<PackageAdjustmentInvoiceInputQueryResult>(
					ctx.runQuery(internal.packageAdjustments.getPackageAdjustmentInvoiceInput, args)
				)
			)
			// Validate and render the stored adjustment invoice artifact.
			.andThen((invoiceInput) => createPackageAdjustmentInvoiceArtifacts(invoiceInput))
			// Convert PDF rendering failures into the public download error.
			.andThen((artifactsResult) =>
				renderBookingInvoicePdfInNode(artifactsResult.artifacts.data)
					.mapErr(() => ({ reason: "INVOICE_DOWNLOAD_FAILED" as const }))
					.map((pdfContent) => ({
						content: pdfContent.buffer.slice(
							pdfContent.byteOffset,
							pdfContent.byteOffset + pdfContent.byteLength
						),
						contentType: artifactsResult.artifacts.pdf.contentType,
						filename: artifactsResult.artifacts.pdf.filename
					}))
			)
	);
}
