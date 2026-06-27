import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import {
	buildBookingInvoiceData,
	buildMultiBookingInvoiceData
} from "#studio/features/booking-invoice/lib/build-booking-invoice-data";
import {
	SAMPLE_BOOKING_INVOICE_INPUT,
	SAMPLE_MULTI_BOOKING_INVOICE_INPUT
} from "#studio/features/booking-invoice/lib/sample-booking-invoice-input";
import { renderBookingInvoicePdf } from "#studio/features/booking-invoice/pdf/render-booking-invoice-pdf";

const BOOKING_OUTPUT_PATH = resolve(process.cwd(), "tmp/booking-invoice-preview.pdf");
const MULTI_BOOKING_OUTPUT_PATH = resolve(process.cwd(), "tmp/multi-booking-invoice-preview.pdf");

async function main() {
	const invoiceData = buildBookingInvoiceData(SAMPLE_BOOKING_INVOICE_INPUT);
	const multiBookingInvoiceData = buildMultiBookingInvoiceData(SAMPLE_MULTI_BOOKING_INVOICE_INPUT);
	const invoicePdfBytes = await renderBookingInvoicePdf(invoiceData);
	const multiBookingPdfBytes = await renderBookingInvoicePdf(multiBookingInvoiceData);

	await mkdir(dirname(BOOKING_OUTPUT_PATH), { recursive: true });
	await writeFile(BOOKING_OUTPUT_PATH, invoicePdfBytes);
	await writeFile(MULTI_BOOKING_OUTPUT_PATH, multiBookingPdfBytes);

	console.log(`Wrote sample booking invoice PDF to ${BOOKING_OUTPUT_PATH}`);
	console.log(`Wrote sample multi-booking invoice PDF to ${MULTI_BOOKING_OUTPUT_PATH}`);
}

void main();
