import { err, ok } from "neverthrow";
import type { Doc } from "#convex/_generated/dataModel";

export const INVOICE_DOWNLOAD_EXPIRY_MS = 60 * 60 * 1000;

export type InvoicePdfPayload = { content: ArrayBuffer; contentType: string; filename: string };

export function toInvoicePdfPayload(
	pdfContent: Uint8Array<ArrayBuffer>,
	metadata: { contentType: string; filename: string }
): InvoicePdfPayload {
	return {
		content: pdfContent.buffer.slice(
			pdfContent.byteOffset,
			pdfContent.byteOffset + pdfContent.byteLength
		),
		contentType: metadata.contentType,
		filename: metadata.filename
	};
}

export function validateBookingInvoiceDownload(booking: Doc<"bookings">, now: number) {
	if (booking.status !== "confirmed" && booking.status !== "email_failed") {
		return err({ reason: "BOOKING_NOT_CONFIRMED" as const });
	}

	const invoiceCreatedAt =
		booking.paymentCompletedAt ?? booking.bookingConfirmedAt ?? booking.pendingPaymentCreatedAt;
	if (!invoiceCreatedAt || now - invoiceCreatedAt > INVOICE_DOWNLOAD_EXPIRY_MS) {
		return err({ reason: "INVOICE_DOWNLOAD_EXPIRED" as const });
	}

	return ok({ booking, invoiceCreatedAt });
}

export function validatePackageInvoiceDownload(
	packageFromDb: Doc<"multiBookingPackages">,
	now: number
) {
	if (now - packageFromDb.createdAt > INVOICE_DOWNLOAD_EXPIRY_MS) {
		return err({ reason: "INVOICE_DOWNLOAD_EXPIRED" as const });
	}

	return ok(packageFromDb);
}
