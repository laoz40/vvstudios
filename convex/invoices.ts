"use node";

import { v } from "convex/values";
import { err, ok, type Result } from "../src/lib/result";
import { calculateMultiBookingAmounts } from "../src/sites/studio/features/booking-form/lib/booking-pricing";
import { multiBookingFormSchema } from "../src/sites/studio/features/booking-form/lib/booking-form-model";
import {
	buildMultiBookingInvoiceData,
	createMultiBookingInvoiceLineItemSnapshot
} from "../src/sites/studio/features/booking-invoice/lib/build-booking-invoice-data";
import { api, internal } from "./_generated/api";
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

export const getAdminCustomMultiBookingInvoicePdfById = action({
	args: { customInvoiceId: v.id("customInvoices") },
	handler: (ctx, args) => getAdminCustomMultiBookingInvoicePdfByIdHandler(ctx, args)
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

	const bookingSettings = await ctx.runQuery(api.bookingSettings.get, {});
	return renderMultiBookingInvoicePdf(multiBooking, bookingSettings.leadTimeMinutes);
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

	const bookingSettings = await ctx.runQuery(api.bookingSettings.get, {});
	return renderMultiBookingInvoicePdf(multiBooking, bookingSettings.leadTimeMinutes);
}

async function getAdminCustomMultiBookingInvoicePdfByIdHandler(
	ctx: ActionCtx,
	args: { customInvoiceId: Id<"customInvoices"> }
): Promise<Result<InvoicePdfPayload, AdminMultiBookingInvoicePdfError>> {
	const [authError] = await getAdminIdentity(ctx);

	if (authError !== null) {
		return err(authError);
	}

	const source = await ctx.runQuery(
		internal.customInvoices.getPackageCustomInvoiceSourceInternal,
		args
	);

	if (!source) {
		return err({ reason: "PACKAGE_NOT_FOUND" });
	}

	const bookingSettings = await ctx.runQuery(api.bookingSettings.get, {});
	const packageSize = source.customInvoice.packageSize ?? source.multiBooking.packageSize;
	const parsedCustomInvoice = multiBookingFormSchema.safeParse({
		name: source.multiBooking.name,
		phone: source.multiBooking.phone,
		accountName: source.multiBooking.accountName,
		abn: source.multiBooking.abn,
		email: source.multiBooking.email,
		duration: source.customInvoice.duration ?? source.multiBooking.duration,
		service: source.customInvoice.service ?? source.multiBooking.service,
		addons: source.customInvoice.addons,
		essentialEditQuantity:
			source.customInvoice.essentialEditQuantity ?? source.multiBooking.essentialEditQuantity ?? "",
		clipsPackageQuantity:
			source.customInvoice.clipsPackageQuantity ?? source.multiBooking.clipsPackageQuantity ?? "",
		notes: source.multiBooking.notes ?? "",
		packageSize
	});

	if (!parsedCustomInvoice.success) {
		return err({ reason: "INVALID_BOOKING_DATA" });
	}

	const customInvoiceData = parsedCustomInvoice.data;
	const amounts = calculateMultiBookingAmounts({
		addons: customInvoiceData.addons,
		clipsPackageQuantity: customInvoiceData.clipsPackageQuantity,
		duration: customInvoiceData.duration,
		essentialEditQuantity: customInvoiceData.essentialEditQuantity,
		packageSize
	});
	const totalDueAmount = source.customInvoice.customTotalDueAmount ?? amounts.totalDueAmount;
	const invoiceLineItems = createMultiBookingInvoiceLineItemSnapshot({
		addons: customInvoiceData.addons,
		clipsPackageQuantity: customInvoiceData.clipsPackageQuantity || undefined,
		discountAmount: amounts.discountAmount,
		discountPercent: amounts.discountPercent,
		duration: customInvoiceData.duration,
		essentialEditQuantity: customInvoiceData.essentialEditQuantity || undefined,
		packageSize,
		service: customInvoiceData.service
	});
	const priceAdjustmentAmount = totalDueAmount - amounts.totalDueAmount;

	if (priceAdjustmentAmount !== 0) {
		invoiceLineItems.push({
			amount: priceAdjustmentAmount,
			description: "Custom price adjustment",
			quantity: 1,
			rate: priceAdjustmentAmount
		});
	}

	const invoiceDueAt = source.customInvoice.dueDate
		? new Date(`${source.customInvoice.dueDate}T00:00:00`).getTime()
		: source.multiBooking.invoiceDueAt;
	const data = buildMultiBookingInvoiceData({
		bookingId: source.multiBooking._id,
		name: customInvoiceData.name,
		phone: customInvoiceData.phone,
		accountName: customInvoiceData.accountName,
		abn: customInvoiceData.abn,
		email: customInvoiceData.email,
		duration: customInvoiceData.duration,
		service: customInvoiceData.service,
		addons: customInvoiceData.addons,
		essentialEditQuantity: customInvoiceData.essentialEditQuantity || undefined,
		clipsPackageQuantity: customInvoiceData.clipsPackageQuantity || undefined,
		createdAt: source.customInvoice.createdAt,
		invoiceDueAt,
		invoiceNumber: source.customInvoice.invoiceNumber,
		packageSize,
		packageSubtotalAmount: amounts.packageSubtotalAmount,
		discountPercent: amounts.discountPercent,
		discountAmount: amounts.discountAmount,
		totalDueAmount,
		invoiceLineItems,
		leadTimeMinutes: bookingSettings.leadTimeMinutes
	});
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

export type GetBookingInvoicePdfByStripeSessionIdResult = Awaited<
	ReturnType<typeof getBookingInvoicePdfByStripeSessionIdHandler>
>;

export type GetMultiBookingInvoicePdfByIdResult = Awaited<
	ReturnType<typeof getMultiBookingInvoicePdfByIdHandler>
>;

export type GetAdminMultiBookingInvoicePdfByIdResult = Awaited<
	ReturnType<typeof getAdminMultiBookingInvoicePdfByIdHandler>
>;

export type GetAdminCustomMultiBookingInvoicePdfByIdResult = Awaited<
	ReturnType<typeof getAdminCustomMultiBookingInvoicePdfByIdHandler>
>;
