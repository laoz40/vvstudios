import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { buildBookingInvoiceData } from "#studio/features/booking-invoice/lib/build-booking-invoice-data";
import { SAMPLE_BOOKING_INVOICE_INPUT } from "#studio/features/booking-invoice/lib/sample-booking-invoice-input";
import { renderBookingInvoicePdf } from "#studio/features/booking-invoice/pdf/render-booking-invoice-pdf";

const OUTPUT_PATH = resolve(process.cwd(), "tmp/booking-invoice-preview.pdf");

async function main() {
	const invoiceData = buildBookingInvoiceData(SAMPLE_BOOKING_INVOICE_INPUT);
	const pdfBytes = await renderBookingInvoicePdf(invoiceData);

	await mkdir(dirname(OUTPUT_PATH), { recursive: true });
	await writeFile(OUTPUT_PATH, pdfBytes);

	console.log(`Wrote sample booking invoice PDF to ${OUTPUT_PATH}`);
}

void main();
