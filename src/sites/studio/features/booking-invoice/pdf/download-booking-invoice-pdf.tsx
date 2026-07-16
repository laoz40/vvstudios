import type { BookingInvoiceBuilderInput } from "#studio/features/booking-invoice/lib/types";
import { createBookingInvoicePdfBase } from "#studio/features/booking-invoice/pdf/create-booking-invoice-pdf-base";
import { downloadBlob } from "#studio/features/booking-invoice/pdf/download-blob";

export async function downloadBookingInvoicePdf(input: BookingInvoiceBuilderInput) {
	const { data, filename, instance } = createBookingInvoicePdfBase(input);
	const blob = await instance.toBlob();

	downloadBlob(blob, filename);

	return data.invoice.number;
}
