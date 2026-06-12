"use node";

import { v } from "convex/values";
import { err, ok } from "../src/lib/result";
import { internal } from "./_generated/api";
import { action, type ActionCtx } from "./_generated/server";
import {
	createBookingInvoiceEmailArtifactsForBooking,
	renderBookingInvoicePdfInNode
} from "./lib/bookingInvoiceArtifacts";

type GetBookingInvoicePdfByStripeSessionIdArgs = { stripeSessionId: string };

const INVOICE_DOWNLOAD_EXPIRY_MS = 60 * 60 * 1000;

export const getBookingInvoicePdfByStripeSessionId = action({
	args: { stripeSessionId: v.string() },
	handler: (ctx, args) => getBookingInvoicePdfByStripeSessionIdHandler(ctx, args)
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

	const [artifactsError, artifactsResult] = await createBookingInvoiceEmailArtifactsForBooking(
		booking,
		invoiceCreatedAt
	);

	if (artifactsError !== null) {
		return err(artifactsError);
	}

	let pdfContent: Awaited<ReturnType<typeof renderBookingInvoicePdfInNode>>;

	try {
		pdfContent = await renderBookingInvoicePdfInNode(artifactsResult.artifacts.data);
	} catch {
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
