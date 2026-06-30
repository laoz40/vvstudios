"use node";

import { v } from "convex/values";
import { err, ok, type Result } from "../src/lib/result";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { action, type ActionCtx } from "./_generated/server";
import {
	createBookingInvoiceArtifactsForBooking,
	createMultiBookingInvoiceArtifacts,
	renderBookingInvoicePdfInNode
} from "./lib/bookingInvoiceArtifacts";
import { getAdminIdentity } from "./lib/auth";

type GetBookingInvoicePdfByStripeSessionIdArgs = { stripeSessionId: string };

const INVOICE_DOWNLOAD_EXPIRY_MS = 60 * 60 * 1000;

export const getBookingInvoicePdfByStripeSessionId = action({
	args: { stripeSessionId: v.string() },
	handler: (ctx, args) => getBookingInvoicePdfByStripeSessionIdHandler(ctx, args)
});

type GetMultiBookingInvoicePdfByIdArgs = { multiBookingId: Id<"multiBookingPackages"> };
type InvoicePdfPayload = { content: ArrayBuffer; contentType: string; filename: string };
type MultiBookingInvoicePdfError =
	| { reason: "INVALID_BOOKING_DATA" }
	| { reason: "INVOICE_DOWNLOAD_FAILED" }
	| { reason: "INVOICE_EMAIL_RENDER_FAILED" };
type PublicMultiBookingInvoicePdfError =
	| MultiBookingInvoicePdfError
	| { reason: "INVOICE_DOWNLOAD_EXPIRED" }
	| { reason: "PACKAGE_NOT_FOUND" };
type AdminMultiBookingInvoicePdfError =
	| MultiBookingInvoicePdfError
	| { reason: "NOT_AUTHENTICATED" }
	| { reason: "NOT_AUTHORIZED" }
	| { reason: "PACKAGE_NOT_FOUND" };

export const getMultiBookingInvoicePdfById = action({
	args: { multiBookingId: v.id("multiBookingPackages") },
	handler: (ctx, args) => getMultiBookingInvoicePdfByIdHandler(ctx, args)
});

export const getAdminMultiBookingInvoicePdfById = action({
	args: { multiBookingId: v.id("multiBookingPackages") },
	handler: (ctx, args) => getAdminMultiBookingInvoicePdfByIdHandler(ctx, args)
});

async function getBookingInvoicePdfByStripeSessionIdHandler(
	ctx: ActionCtx,
	args: GetBookingInvoicePdfByStripeSessionIdArgs
) {
	const booking = await ctx.runQuery(internal.bookings.getBookingByStripeSessionIdInternal, {
		stripeSessionId: args.stripeSessionId
	});

	if (!booking) {
		return err({ reason: "BOOKING_NOT_FOUND" });
	}

	if (booking.status !== "confirmed" && booking.status !== "email_failed") {
		return err({ reason: "BOOKING_NOT_CONFIRMED" });
	}

	const invoiceCreatedAt =
		booking.paymentCompletedAt ?? booking.bookingConfirmedAt ?? booking.pendingPaymentCreatedAt;

	if (!invoiceCreatedAt || Date.now() - invoiceCreatedAt > INVOICE_DOWNLOAD_EXPIRY_MS) {
		return err({ reason: "INVOICE_DOWNLOAD_EXPIRED" });
	}

	const [artifactsError, artifactsResult] = createBookingInvoiceArtifactsForBooking(
		booking,
		invoiceCreatedAt
	);

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

async function getMultiBookingInvoicePdfByIdHandler(
	ctx: ActionCtx,
	args: GetMultiBookingInvoicePdfByIdArgs
): Promise<Result<InvoicePdfPayload, PublicMultiBookingInvoicePdfError>> {
	const multiBooking: Doc<"multiBookingPackages"> | null = await ctx.runQuery(
		internal.bookings.getPackageByIdInternal,
		{ multiBookingId: args.multiBookingId }
	);

	if (!multiBooking) {
		return err({ reason: "PACKAGE_NOT_FOUND" });
	}

	if (Date.now() - multiBooking.createdAt > INVOICE_DOWNLOAD_EXPIRY_MS) {
		return err({ reason: "INVOICE_DOWNLOAD_EXPIRED" });
	}

	return renderMultiBookingInvoicePdf(multiBooking);
}

async function getAdminMultiBookingInvoicePdfByIdHandler(
	ctx: ActionCtx,
	args: GetMultiBookingInvoicePdfByIdArgs
): Promise<Result<InvoicePdfPayload, AdminMultiBookingInvoicePdfError>> {
	const [authError] = await getAdminIdentity(ctx);

	if (authError !== null) {
		return err(authError);
	}

	const multiBooking: Doc<"multiBookingPackages"> | null = await ctx.runQuery(
		internal.bookings.getPackageByIdInternal,
		{ multiBookingId: args.multiBookingId }
	);

	if (!multiBooking) {
		return err({ reason: "PACKAGE_NOT_FOUND" });
	}

	return renderMultiBookingInvoicePdf(multiBooking);
}

async function renderMultiBookingInvoicePdf(
	multiBooking: Doc<"multiBookingPackages">
): Promise<Result<InvoicePdfPayload, MultiBookingInvoicePdfError>> {
	const [artifactsError, artifactsResult] = await createMultiBookingInvoiceArtifacts(multiBooking);

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

export type GetBookingInvoicePdfByStripeSessionIdResult = Awaited<
	ReturnType<typeof getBookingInvoicePdfByStripeSessionIdHandler>
>;

export type GetMultiBookingInvoicePdfByIdResult = Awaited<
	ReturnType<typeof getMultiBookingInvoicePdfByIdHandler>
>;

export type GetAdminMultiBookingInvoicePdfByIdResult = Awaited<
	ReturnType<typeof getAdminMultiBookingInvoicePdfByIdHandler>
>;
