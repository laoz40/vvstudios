import { BookingReceiptEmail } from "#studio/features/booking-invoice/email/BookingReceiptEmail";
import { buildPackageReceiptData } from "#studio/features/booking-invoice/lib/build-booking-receipt-data";
import { SAMPLE_PACKAGE_RECEIPT_INPUT } from "#studio/features/booking-invoice/lib/sample-booking-invoice-input";

const previewData = buildPackageReceiptData(SAMPLE_PACKAGE_RECEIPT_INPUT);

export default function PackagePaidEmailPreview() {
	return <BookingReceiptEmail data={previewData} />;
}

PackagePaidEmailPreview.PreviewProps = { data: previewData };
