import type { Readable } from "node:stream";
import type { BookingInvoiceData } from "#studio/features/booking-invoice/lib/types";
import { createBookingInvoicePdfInstance } from "#studio/features/booking-invoice/pdf/create-booking-invoice-pdf-base";

async function readStream(stream: Readable) {
	const chunks: Uint8Array[] = [];
	let totalLength = 0;

	for await (const chunk of stream) {
		const bytes = chunk instanceof Uint8Array ? chunk : new Uint8Array(chunk);
		chunks.push(bytes);
		totalLength += bytes.byteLength;
	}

	const output = new Uint8Array(totalLength);
	let offset = 0;
	for (const chunk of chunks) {
		output.set(chunk, offset);
		offset += chunk.byteLength;
	}

	return output;
}

export async function renderBookingInvoicePdf(data: BookingInvoiceData) {
	const instance = createBookingInvoicePdfInstance(data);
	const stream = (await instance.toBuffer()) as Readable;
	return await readStream(stream);
}
