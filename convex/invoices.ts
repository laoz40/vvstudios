"use node";

import { v } from "convex/values";
import { err, ok } from "../src/lib/result";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { action, type ActionCtx } from "./_generated/server";
import {
	createBookingInvoiceArtifactsForBooking,
	createMultiBookingInvoiceArtifacts,
	renderBookingInvoicePdfInNode
} from "./lib/bookingInvoiceArtifacts";

type GetBookingInvoicePdfByStripeSessionIdArgs = { stripeSessionId: string };

const INVOICE_DOWNLOAD_EXPIRY_MS = 60 * 60 * 1000;

export const getBookingInvoicePdfByStripeSessionId = action({
	args: { stripeSessionId: v.string() },
	handler: (ctx, args) => getBookingInvoicePdfByStripeSessionIdHandler(ctx, args)
});

type GetMultiBookingInvoicePdfByIdArgs = { multiBookingId: Id<"multiBookingPackages"> };

export const getMultiBookingInvoicePdfById = action({
	args: { multiBookingId: v.id("multiBookingPackages") },
	handler: (ctx, args) => getMultiBookingInvoicePdfByIdHandler(ctx, args)
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
) {
	const multiBooking = await ctx.runQuery(internal.bookings.getPackageByIdInternal, {
		multiBookingId: args.multiBookingId
	});

	if (!multiBooking) {
		return err({ reason: "PACKAGE_NOT_FOUND" });
	}

	if (multiBooking.status !== "pending_payment" && multiBooking.status !== "invoice_email_failed") {
		return err({ reason: "PACKAGE_INVOICE_NOT_AVAILABLE" });
	}

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
