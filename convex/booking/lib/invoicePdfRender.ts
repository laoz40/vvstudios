import { tryPromise } from "#convex/shared/lib/result";
import { logError } from "#convex/shared/lib/logger";
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
			logError(
				{
					operation: "pdf.renderBookingInvoice",
					reason: "INVOICE_PDF_RENDER_FAILED",
					invoiceNumber: data.invoice.number
				},
				cause
			);

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
			logError(
				{
					operation: "pdf.renderBookingReceipt",
					reason: "RECEIPT_PDF_RENDER_FAILED",
					receiptNumber: data.receipt.number
				},
				cause
			);

			return { reason: "RECEIPT_PDF_RENDER_FAILED" as const };
		}
	});
}
