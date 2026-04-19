import { BookingInvoiceEmail } from "../src/features/booking-invoice/email/BookingInvoiceEmail";
import { buildBookingInvoiceData } from "../src/features/booking-invoice/lib/build-booking-invoice-data";
import { SAMPLE_BOOKING_INVOICE_INPUT } from "../src/features/booking-invoice/lib/sample-booking-invoice-input";

const previewData = buildBookingInvoiceData(SAMPLE_BOOKING_INVOICE_INPUT);

export default function BookingInvoicePreviewEmail() {
	return <BookingInvoiceEmail data={previewData} />;
}

BookingInvoicePreviewEmail.PreviewProps = {
	data: previewData,
};
