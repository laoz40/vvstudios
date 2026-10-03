import { tryPromise } from "#convex/lib/result";
import type {
	BookingInvoiceData,
	BookingReceiptData
} from "#studio/features/booking-invoice/lib/types";

export function renderBookingInvoicePdfInNode(data: BookingInvoiceData) {
	return tryPromise({
		try: async () => {
			const { renderBookingInvoicePdf } =
				await import("#studio/features/booking-invoice/pdf/render-booking-invoice-pdf");

			return renderBookingInvoicePdf(data);
		},
		catch: (cause) => {
			console.error("Booking invoice PDF render failed", {
				invoiceNumber: data.invoice.number,
				cause
			});

			return { reason: "INVOICE_PDF_RENDER_FAILED" as const };
		}
	});
}

export function renderBookingReceiptPdfInNode(data: BookingReceiptData) {
	return tryPromise({
		try: async () => {
			const { renderBookingReceiptPdf } =
				await import("#studio/features/booking-invoice/pdf/render-booking-receipt-pdf");

			return renderBookingReceiptPdf(data);
		},
		catch: (cause) => {
			console.error("Booking receipt PDF render failed", {
				receiptNumber: data.receipt.number,
				cause
			});

			return { reason: "RECEIPT_PDF_RENDER_FAILED" as const };
		}
	});
}
