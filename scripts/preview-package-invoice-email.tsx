import { BookingInvoiceEmail } from "#studio/features/booking-invoice/email/BookingInvoiceEmail";
import { buildPackageInvoiceData } from "#studio/features/booking-invoice/lib/build-booking-invoice-data";
import { SAMPLE_PACKAGE_INVOICE_INPUT } from "#studio/features/booking-invoice/lib/sample-booking-invoice-input";

const previewData = buildPackageInvoiceData(SAMPLE_PACKAGE_INVOICE_INPUT);

export default function PackageInvoicePreviewEmail() {
	return <BookingInvoiceEmail data={previewData} />;
}

PackageInvoicePreviewEmail.PreviewProps = { data: previewData };
