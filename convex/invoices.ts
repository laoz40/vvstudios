"use node";

import { ConvexError, v } from "convex/values";
import { internal } from "./_generated/api";
import { action } from "./_generated/server";
import {
	createBookingInvoiceEmailArtifactsForBooking,
	renderBookingInvoicePdfInNode
} from "./lib/bookingInvoiceArtifacts";

type BookingInvoiceDownloadErrorData = {
	code:
		| "BOOKING_NOT_FOUND"
		| "BOOKING_NOT_CONFIRMED"
		| "INVOICE_DOWNLOAD_EXPIRED"
		| "INVALID_BOOKING_DATA"
		| "INVOICE_DOWNLOAD_FAILED";
};

const INVOICE_DOWNLOAD_EXPIRY_MS = 60 * 60 * 1000;

export const getBookingInvoicePdfByStripeSessionId = action({
	args: { stripeSessionId: v.string() },
	handler: async (ctx, args) => {
		const booking = await ctx.runQuery(internal.bookings.getBookingByStripeSessionIdInternal, {
			stripeSessionId: args.stripeSessionId
		});

		if (!booking) {
			throw new ConvexError<BookingInvoiceDownloadErrorData>({ code: "BOOKING_NOT_FOUND" });
		}

		if (booking.status !== "confirmed" && booking.status !== "email_failed") {
			throw new ConvexError<BookingInvoiceDownloadErrorData>({ code: "BOOKING_NOT_CONFIRMED" });
		}

		const invoiceDownloadStartedAt =
			booking.paymentCompletedAt ?? booking.bookingConfirmedAt ?? booking.pendingPaymentCreatedAt;

		if (
			!invoiceDownloadStartedAt ||
			Date.now() - invoiceDownloadStartedAt > INVOICE_DOWNLOAD_EXPIRY_MS
		) {
			throw new ConvexError<BookingInvoiceDownloadErrorData>({ code: "INVOICE_DOWNLOAD_EXPIRED" });
		}

		let artifacts: Awaited<
			ReturnType<typeof createBookingInvoiceEmailArtifactsForBooking>
		>["artifacts"];
		let pdfContent: Awaited<ReturnType<typeof renderBookingInvoicePdfInNode>>;

		try {
			({ artifacts } = await createBookingInvoiceEmailArtifactsForBooking(
				booking,
				booking.pendingPaymentCreatedAt
			));
			pdfContent = await renderBookingInvoicePdfInNode(artifacts.data);
		} catch (error) {
			if (error instanceof ConvexError) {
				throw error;
			}

			throw new ConvexError<BookingInvoiceDownloadErrorData>({ code: "INVOICE_DOWNLOAD_FAILED" });
		}

		return {
			content: pdfContent.buffer.slice(
				pdfContent.byteOffset,
				pdfContent.byteOffset + pdfContent.byteLength
			),
			contentType: artifacts.pdf.contentType,
			filename: artifacts.pdf.filename
		};
	}
});
