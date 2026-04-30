import type { BookingInvoiceBuilderInput } from "#/features/booking-invoice/lib/types";
import { createBookingInvoicePdfBase } from "#/features/booking-invoice/pdf/create-booking-invoice-pdf-base";

function downloadBlob(blob: Blob, filename: string) {
	const url = URL.createObjectURL(blob);
	const link = document.createElement("a");

	link.href = url;
	link.download = filename;
	link.click();

	URL.revokeObjectURL(url);
}

export async function downloadBookingInvoicePdf(input: BookingInvoiceBuilderInput) {
	const { data, filename, instance } = createBookingInvoicePdfBase(input);
	const blob = await instance.toBlob();

	downloadBlob(blob, filename);

	return data.invoice.number;
}
