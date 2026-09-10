import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import {
	buildBookingInvoiceData,
	buildPackageInvoiceData
} from "#studio/features/booking-invoice/lib/build-booking-invoice-data";
import {
	SAMPLE_BOOKING_INVOICE_INPUT,
	SAMPLE_PACKAGE_INVOICE_INPUT
} from "#studio/features/booking-invoice/lib/sample-booking-invoice-input";
import { renderBookingInvoicePdf } from "#studio/features/booking-invoice/pdf/render-booking-invoice-pdf";

const BOOKING_OUTPUT_PATH = resolve(process.cwd(), "tmp/booking-invoice-preview.pdf");

const PACKAGE_OUTPUT_PATH = resolve(process.cwd(), "tmp/package-invoice-preview.pdf");

async function main() {
	const invoiceData = buildBookingInvoiceData(SAMPLE_BOOKING_INVOICE_INPUT);
	const packageInvoiceData = buildPackageInvoiceData(SAMPLE_PACKAGE_INVOICE_INPUT);
	const invoicePdfBytes = await renderBookingInvoicePdf(invoiceData);
	const packagePdfBytes = await renderBookingInvoicePdf(packageInvoiceData);

	await mkdir(dirname(BOOKING_OUTPUT_PATH), { recursive: true });
	await writeFile(BOOKING_OUTPUT_PATH, invoicePdfBytes);
	await writeFile(PACKAGE_OUTPUT_PATH, packagePdfBytes);

	console.log(`Wrote sample booking invoice PDF to ${BOOKING_OUTPUT_PATH}`);
	console.log(`Wrote sample package invoice PDF to ${PACKAGE_OUTPUT_PATH}`);
}

void main();
