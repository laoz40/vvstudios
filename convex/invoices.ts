"use node";

import { ConvexError, v } from "convex/values";
import { internal } from "./_generated/api";
import { action } from "./_generated/server";
import { bookingSchema } from "../src/sites/studio/features/booking-form/lib/form-shared";
import { createBookingInvoiceArtifacts } from "../src/sites/studio/features/booking-invoice/lib/create-booking-invoice-artifacts";

type BookingInvoiceDownloadErrorData = {
	code:
		| "BOOKING_NOT_FOUND"
		| "BOOKING_NOT_CONFIRMED"
		| "INVOICE_DOWNLOAD_EXPIRED"
		| "INVALID_BOOKING_DATA";
};

const INVOICE_DOWNLOAD_EXPIRY_MS = 60 * 60 * 1000;

function createBookingInvoiceDownloadError(code: BookingInvoiceDownloadErrorData["code"]) {
	return new ConvexError<BookingInvoiceDownloadErrorData>({ code });
}

export const getBookingInvoicePdfByStripeSessionId = action({
	args: {
		stripeSessionId: v.string(),
	},
	handler: async (ctx, args) => {
		const booking = await ctx.runQuery(internal.bookings.getBookingByStripeSessionIdInternal, {
			stripeSessionId: args.stripeSessionId,
		});

		if (!booking) {
			throw createBookingInvoiceDownloadError("BOOKING_NOT_FOUND");
		}

		if (booking.status !== "confirmed") {
			throw createBookingInvoiceDownloadError("BOOKING_NOT_CONFIRMED");
		}

		const invoiceDownloadStartedAt =
			booking.paymentCompletedAt ?? booking.bookingConfirmedAt ?? booking.pendingPaymentCreatedAt;

		if (
			!invoiceDownloadStartedAt ||
			Date.now() - invoiceDownloadStartedAt > INVOICE_DOWNLOAD_EXPIRY_MS
		) {
			throw createBookingInvoiceDownloadError("INVOICE_DOWNLOAD_EXPIRED");
		}

		const parsedBooking = bookingSchema.safeParse({
			name: booking.name,
			phone: booking.phone,
			accountName: booking.accountName,
			abn: booking.abn,
			email: booking.email,
			date: booking.date,
			time: booking.time,
			duration: booking.duration,
			service: booking.service,
			addons: booking.addons,
			notes: booking.notes ?? "",
		});

		if (!parsedBooking.success) {
			throw createBookingInvoiceDownloadError("INVALID_BOOKING_DATA");
		}

		const artifacts = await createBookingInvoiceArtifacts({
			bookingId: booking._id,
			name: parsedBooking.data.name,
			phone: parsedBooking.data.phone,
			accountName: parsedBooking.data.accountName,
			abn: parsedBooking.data.abn,
			email: parsedBooking.data.email,
			date: parsedBooking.data.date,
			time: parsedBooking.data.time,
			duration: parsedBooking.data.duration,
			service: parsedBooking.data.service,
			addons: parsedBooking.data.addons,
			createdAt: booking.pendingPaymentCreatedAt,
		});

		return {
			content: artifacts.pdf.content.buffer.slice(
				artifacts.pdf.content.byteOffset,
				artifacts.pdf.content.byteOffset + artifacts.pdf.content.byteLength,
			),
			contentType: artifacts.pdf.contentType,
			filename: artifacts.pdf.filename,
		};
	},
});
