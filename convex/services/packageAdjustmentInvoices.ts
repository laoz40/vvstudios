"use node";

import { err, ok, type ResultAsync as NeverthrowResultAsync } from "neverthrow";
import type { Result as ConvexResult } from "#/lib/result";
import { internal } from "#convex/_generated/api";
import type { Id } from "#convex/_generated/dataModel";
import type { ActionCtx } from "#convex/_generated/server";
import { requirePermissionActions } from "#convex/lib/auth";
import {
	createPackageAdjustmentInvoiceArtifacts,
	renderBookingInvoicePdfInNode,
	type PackageAdjustmentInvoiceInput
} from "#convex/lib/bookingInvoiceArtifacts";
import { fromConvexTuple } from "#convex/lib/result";
import { createAndSendPackageAdjustmentStripeInvoice } from "#convex/lib/stripeAdjustmentInvoice";
import { getStripeClient, type StripeClient } from "#convex/lib/stripeClient";

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
	| { reason: "INVOICE_PDF_RENDER_FAILED" };

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
	return fromConvexTuple<Promise<ConvexResult<{ updated: boolean }, { reason: string }>>>(
		ctx.runMutation(internal.packageAdjustments.markPackageAdjustmentInvoiceEmailFailed, args)
	)
		.orElse(() => ok(null))
		.andThen(() => err({ reason: "PACKAGE_ADJUSTMENT_INVOICE_EMAIL_FAILED" as const }));
}

export function sendPackageAdjustmentInvoiceService(
	ctx: ActionCtx,
	args: SendPackageAdjustmentInvoiceArgs,
	stripe: StripeClient = getStripeClient()
): NeverthrowResultAsync<null, SendPackageAdjustmentInvoiceError> {
	const claimedAt = Date.now();

	return (
		fromConvexTuple<
			Promise<ConvexResult<PackageAdjustmentInvoiceInput, PackageAdjustmentClaimError>>
		>(
			ctx.runMutation(internal.packageAdjustments.claimPackageAdjustmentInvoiceEmail, {
				adjustmentId: args.adjustmentId,
				attempt: args.attempt,
				now: claimedAt
			})
		)
			// Create and send the claimed adjustment invoice through Stripe.
			.andThen((invoiceInput) => {
				const { adjustment, packageRecord } = invoiceInput;

				if (!packageRecord.stripeCustomerId) {
					return markPackageAdjustmentInvoiceEmailFailed(ctx, {
						adjustmentId: args.adjustmentId,
						claimedAt
					});
				}

				return createAndSendPackageAdjustmentStripeInvoice(stripe, {
					adjustmentId: args.adjustmentId,
					packageId: packageRecord._id,
					stripeCustomerId: packageRecord.stripeCustomerId,
					quantity: adjustment.quantity
				})
					.orElse(() =>
						markPackageAdjustmentInvoiceEmailFailed(ctx, {
							adjustmentId: args.adjustmentId,
							claimedAt
						})
					)
					.andThen(({ stripeInvoiceId }) =>
						fromConvexTuple<
							Promise<
								ConvexResult<{ updated: boolean }, { reason: "PACKAGE_ADJUSTMENT_NOT_FOUND" }>
							>
						>(
							ctx.runMutation(internal.packageAdjustments.markPackageAdjustmentInvoiceEmailSent, {
								adjustmentId: args.adjustmentId,
								claimedAt,
								stripeInvoiceId
							})
						).map(() => null)
					);
			})
	);
}

export function retryPackageAdjustmentInvoiceEmailService(
	ctx: ActionCtx,
	args: { adjustmentId: Id<"packageAdjustments"> }
): NeverthrowResultAsync<
	null,
	SendPackageAdjustmentInvoiceError | { reason: "NOT_AUTHENTICATED" } | { reason: "NOT_AUTHORIZED" }
> {
	return requirePermissionActions(ctx, "send:invoice-emails").andThen(() =>
		sendPackageAdjustmentInvoiceService(ctx, { ...args, attempt: "retry" })
	);
}

export function getAdminPackageAdjustmentInvoicePdfService(
	ctx: ActionCtx,
	args: { adjustmentId: Id<"packageAdjustments"> }
): NeverthrowResultAsync<InvoicePdfPayload, PackageAdjustmentInvoicePdfError> {
	return (
		requirePermissionActions(ctx, "view:sensitive-booking-data")
			// Load the sent adjustment invoice input only after admin authorization succeeds.
			.andThen(() =>
				fromConvexTuple<PackageAdjustmentInvoiceInputQueryResult>(
					ctx.runQuery(internal.packageAdjustments.getPackageAdjustmentInvoiceInput, args)
				)
			)
			// Validate and render the stored adjustment invoice artifact.
			.andThen((invoiceInput) => createPackageAdjustmentInvoiceArtifacts(invoiceInput))
			// Convert PDF rendering failures into the public download error.
			.andThen((artifactsResult) =>
				renderBookingInvoicePdfInNode(artifactsResult.artifacts.data).map((pdfContent) => ({
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
