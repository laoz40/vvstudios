import { pdf } from "@react-pdf/renderer";
import type { BookingReceiptData } from "#studio/features/booking-invoice/lib/types";
import { BookingReceiptPdf } from "#studio/features/booking-invoice/pdf/BookingReceiptPdf";

export function createBookingReceiptPdfInstance(data: BookingReceiptData) {
	return pdf(<BookingReceiptPdf data={data} />);
}
