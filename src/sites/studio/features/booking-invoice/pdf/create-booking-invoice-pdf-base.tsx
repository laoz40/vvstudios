import { pdf } from "@react-pdf/renderer";
import { buildBookingInvoiceData } from "#studio/features/booking-invoice/lib/build-booking-invoice-data";
import type { BookingInvoiceBuilderInput } from "#studio/features/booking-invoice/lib/types";
import { BookingInvoicePdf } from "#studio/features/booking-invoice/pdf/BookingInvoicePdf";

function createPdfFilename(invoiceNumber: string) {
	return `booking-invoice-${invoiceNumber.toLowerCase()}.pdf`;
}

export function createBookingInvoicePdfInstance(data: ReturnType<typeof buildBookingInvoiceData>) {
	return pdf(<BookingInvoicePdf data={data} />);
}

export function createBookingInvoicePdfBase(input: BookingInvoiceBuilderInput) {
	const data = buildBookingInvoiceData(input);

	return {
		data,
		filename: createPdfFilename(data.invoice.number),
		instance: createBookingInvoicePdfInstance(data),
	};
}
