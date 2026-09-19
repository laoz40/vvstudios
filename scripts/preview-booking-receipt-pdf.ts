import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { buildBookingReceiptData } from "#studio/features/booking-invoice/lib/build-booking-receipt-data";
import { SAMPLE_BOOKING_RECEIPT_INPUT } from "#studio/features/booking-invoice/lib/sample-booking-receipt-input";
import { renderBookingReceiptPdf } from "#studio/features/booking-invoice/pdf/render-booking-receipt-pdf";

const RECEIPT_OUTPUT_PATH = resolve(process.cwd(), "tmp/booking-receipt-preview.pdf");

async function main() {
	const receiptData = buildBookingReceiptData(SAMPLE_BOOKING_RECEIPT_INPUT);
	const receiptPdfBytes = await renderBookingReceiptPdf(receiptData);

	await mkdir(dirname(RECEIPT_OUTPUT_PATH), { recursive: true });
	await writeFile(RECEIPT_OUTPUT_PATH, receiptPdfBytes);

	console.log(`Wrote sample booking receipt PDF to ${RECEIPT_OUTPUT_PATH}`);
}

void main();
