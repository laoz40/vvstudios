"use node";

import { v } from "convex/values";
import { err, ok, type Result } from "../src/lib/result";
import { api, internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { action, type ActionCtx } from "./_generated/server";
import {
	createBookingInvoiceArtifactsForBooking,
	createCustomMultiBookingInvoiceData,
	createMultiBookingInvoiceArtifacts,
	renderBookingInvoicePdfInNode
} from "./lib/bookingInvoiceArtifacts";
import { getAdminIdentity } from "./lib/auth";

const INVOICE_DOWNLOAD_EXPIRY_MS = 60 * 60 * 1000;

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

type GetBookingInvoicePdfByStripeSessionIdArgs = { stripeSessionId: string };

export const getBookingInvoicePdfByStripeSessionId = action({
	args: { stripeSessionId: v.string() },
	handler: (ctx, args) => getBookingInvoicePdfByStripeSessionIdHandler(ctx, args)
});

async function getBookingInvoicePdfByStripeSessionIdHandler(
	ctx: ActionCtx,
	args: GetBookingInvoicePdfByStripeSessionIdArgs
) {
	const booking = await ctx.runQuery(internal.sessionCheckout.getSessionByStripeSessionId, {
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

	const bookingSettings = await ctx.runQuery(api.bookingSettings.get, {});
	const [artifactsError, artifactsResult] = createBookingInvoiceArtifactsForBooking(
		booking,
		invoiceCreatedAt,
		{ leadTimeMinutes: bookingSettings.leadTimeMinutes }
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

export type GetBookingInvoicePdfByStripeSessionIdResult = Awaited<
	ReturnType<typeof getBookingInvoicePdfByStripeSessionIdHandler>
>;

type GetMultiBookingInvoicePdfByIdArgs = { multiBookingId: Id<"multiBookingPackages"> };

export const getMultiBookingInvoicePdfById = action({
	args: { multiBookingId: v.id("multiBookingPackages") },
	handler: (ctx, args) => getMultiBookingInvoicePdfByIdHandler(ctx, args)
});

async function getMultiBookingInvoicePdfByIdHandler(
	ctx: ActionCtx,
	args: GetMultiBookingInvoicePdfByIdArgs
): Promise<Result<InvoicePdfPayload, PublicMultiBookingInvoicePdfError>> {
	const multiBooking: Doc<"multiBookingPackages"> | null = await ctx.runQuery(
		internal.packages.getPackageById,
		{ multiBookingId: args.multiBookingId }
	);

	if (!multiBooking) {
		return err({ reason: "PACKAGE_NOT_FOUND" });
	}

	if (Date.now() - multiBooking.createdAt > INVOICE_DOWNLOAD_EXPIRY_MS) {
		return err({ reason: "INVOICE_DOWNLOAD_EXPIRED" });
	}

	const bookingSettings = await ctx.runQuery(api.bookingSettings.get, {});
	return renderMultiBookingInvoicePdf(multiBooking, bookingSettings.leadTimeMinutes);
}

export type GetMultiBookingInvoicePdfByIdResult = Awaited<
	ReturnType<typeof getMultiBookingInvoicePdfByIdHandler>
>;

export const getAdminMultiBookingInvoicePdfById = action({
	args: { multiBookingId: v.id("multiBookingPackages") },
	handler: (ctx, args) => getAdminMultiBookingInvoicePdfByIdHandler(ctx, args)
});

async function getAdminMultiBookingInvoicePdfByIdHandler(
	ctx: ActionCtx,
	args: GetMultiBookingInvoicePdfByIdArgs
): Promise<Result<InvoicePdfPayload, AdminMultiBookingInvoicePdfError>> {
	const [authError] = await getAdminIdentity(ctx);

	if (authError !== null) {
		return err(authError);
	}

	const multiBooking: Doc<"multiBookingPackages"> | null = await ctx.runQuery(
		internal.packages.getPackageById,
		{ multiBookingId: args.multiBookingId }
	);

	if (!multiBooking) {
		return err({ reason: "PACKAGE_NOT_FOUND" });
	}

	const bookingSettings = await ctx.runQuery(api.bookingSettings.get, {});
	return renderMultiBookingInvoicePdf(multiBooking, bookingSettings.leadTimeMinutes);
}

export type GetAdminMultiBookingInvoicePdfByIdResult = Awaited<
	ReturnType<typeof getAdminMultiBookingInvoicePdfByIdHandler>
>;

type GetAdminCustomMultiBookingInvoicePdfByIdArgs = { customInvoiceId: Id<"customInvoices"> };

export const getAdminCustomMultiBookingInvoicePdfById = action({
	args: { customInvoiceId: v.id("customInvoices") },
	handler: (ctx, args) => getAdminCustomMultiBookingInvoicePdfByIdHandler(ctx, args)
});

async function getAdminCustomMultiBookingInvoicePdfByIdHandler(
	ctx: ActionCtx,
	args: GetAdminCustomMultiBookingInvoicePdfByIdArgs
): Promise<Result<InvoicePdfPayload, AdminMultiBookingInvoicePdfError>> {
	const [authError] = await getAdminIdentity(ctx);

	if (authError !== null) {
		return err(authError);
	}

	const source = await ctx.runQuery(internal.customInvoices.getPackageCustomInvoiceSource, args);

	if (!source) {
		return err({ reason: "PACKAGE_NOT_FOUND" });
	}

	const bookingSettings = await ctx.runQuery(api.bookingSettings.get, {});
	const [dataError, data] = createCustomMultiBookingInvoiceData(
		source,
		bookingSettings.leadTimeMinutes
	);

	if (dataError !== null) {
		return err(dataError);
	}

	const [pdfError, pdfContent] = await renderBookingInvoicePdfInNode(data);

	if (pdfError !== null) {
		return err({ reason: "INVOICE_DOWNLOAD_FAILED" });
	}

	return ok({
		content: pdfContent.buffer.slice(
			pdfContent.byteOffset,
			pdfContent.byteOffset + pdfContent.byteLength
		),
		contentType: "application/pdf",
		filename: `booking-invoice-${data.invoice.number.toLowerCase()}.pdf`
	});
}

export type GetAdminCustomMultiBookingInvoicePdfByIdResult = Awaited<
	ReturnType<typeof getAdminCustomMultiBookingInvoicePdfByIdHandler>
>;

async function renderMultiBookingInvoicePdf(
	multiBooking: Doc<"multiBookingPackages">,
	leadTimeMinutes: number
): Promise<Result<InvoicePdfPayload, MultiBookingInvoicePdfError>> {
	const [artifactsError, artifactsResult] = await createMultiBookingInvoiceArtifacts(multiBooking, {
		leadTimeMinutes
	});

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
