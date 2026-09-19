import { BookingReceiptEmail } from "#studio/features/booking-invoice/email/BookingReceiptEmail";
import { buildBookingReceiptData } from "#studio/features/booking-invoice/lib/build-booking-receipt-data";
import { SAMPLE_BOOKING_RECEIPT_INPUT } from "#studio/features/booking-invoice/lib/sample-booking-receipt-input";

const previewData = buildBookingReceiptData(SAMPLE_BOOKING_RECEIPT_INPUT);

export default function BookingReceiptPreviewEmail() {
	return <BookingReceiptEmail data={previewData} />;
}

BookingReceiptPreviewEmail.PreviewProps = { data: previewData };
