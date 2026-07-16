import { BookingInvoiceEmail } from "#studio/features/booking-invoice/email/BookingInvoiceEmail";
import { buildMultiBookingInvoiceData } from "#studio/features/booking-invoice/lib/build-booking-invoice-data";
import { SAMPLE_MULTI_BOOKING_INVOICE_INPUT } from "#studio/features/booking-invoice/lib/sample-booking-invoice-input";

const previewData = buildMultiBookingInvoiceData(SAMPLE_MULTI_BOOKING_INVOICE_INPUT);

export default function MultiBookingInvoicePreviewEmail() {
	return <BookingInvoiceEmail data={previewData} />;
}

MultiBookingInvoicePreviewEmail.PreviewProps = { data: previewData };
