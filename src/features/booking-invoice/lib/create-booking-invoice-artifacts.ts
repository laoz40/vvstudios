import type {
	BookingInvoiceArtifacts,
	BookingInvoiceBuilderInput,
} from "#/features/booking-invoice/lib/types";
import { renderBookingInvoiceEmail } from "#/features/booking-invoice/email/render-booking-invoice-email";
import { createBookingInvoicePdfBase } from "#/features/booking-invoice/pdf/create-booking-invoice-pdf-base";
import { renderBookingInvoicePdf } from "#/features/booking-invoice/pdf/render-booking-invoice-pdf";

export async function createBookingInvoiceArtifacts(
	input: BookingInvoiceBuilderInput,
): Promise<BookingInvoiceArtifacts> {
	const { data, filename } = createBookingInvoicePdfBase(input);
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
			filename,
		},
	};
}
