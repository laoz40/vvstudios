import { buildBookingInvoiceData } from "#/features/booking-invoice/lib/build-booking-invoice-data";
import type {
	BookingInvoiceArtifacts,
	BookingInvoiceBuilderInput,
} from "#/features/booking-invoice/lib/types";
import { renderBookingInvoiceEmail } from "#/features/booking-invoice/email/render-booking-invoice-email";
import { renderBookingInvoicePdf } from "#/features/booking-invoice/pdf/render-booking-invoice-pdf";

function createPdfFilename(invoiceNumber: string) {
	return `booking-invoice-${invoiceNumber.toLowerCase()}.pdf`;
}

export async function createBookingInvoiceArtifacts(
	input: BookingInvoiceBuilderInput,
): Promise<BookingInvoiceArtifacts> {
	const data = buildBookingInvoiceData(input);
	const [emailHtml, pdfContent] = await Promise.all([
		renderBookingInvoiceEmail(data),
		renderBookingInvoicePdf(data),
	]);

	return {
		data,
		emailHtml,
		pdf: {
			content: pdfContent,
			contentType: "application/pdf",
			filename: createPdfFilename(data.invoice.number),
		},
	};
}
