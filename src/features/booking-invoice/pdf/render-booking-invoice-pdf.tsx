import { pdf } from "@react-pdf/renderer";
import type { Readable } from "node:stream";
import { BookingInvoicePdf } from "#/features/booking-invoice/pdf/BookingInvoicePdf";
import type { BookingInvoiceData } from "#/features/booking-invoice/lib/types";

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
	const instance = pdf(<BookingInvoicePdf data={data} />);
	const stream = (await instance.toBuffer()) as Readable;
	return await readStream(stream);
}
