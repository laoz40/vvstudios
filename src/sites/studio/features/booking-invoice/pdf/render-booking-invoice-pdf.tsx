import type { BookingInvoiceData } from "#studio/features/booking-invoice/lib/types";
import { createBookingInvoicePdfInstance } from "#studio/features/booking-invoice/pdf/create-booking-invoice-pdf-base";

function isAsyncIterable(value: unknown): value is AsyncIterable<unknown> {
	return (
		value !== null &&
		typeof value === "object" &&
		Symbol.asyncIterator in value &&
		typeof value[Symbol.asyncIterator] === "function"
	);
}

async function readStream(stream: AsyncIterable<unknown>) {
	const chunks: Uint8Array[] = [];
	let totalLength = 0;

	for await (const chunk of stream) {
		const chunkValue: unknown = chunk;
		let bytes: Uint8Array;

		if (chunkValue instanceof Uint8Array) {
			bytes = chunkValue;
		} else if (typeof chunkValue === "string") {
			bytes = new TextEncoder().encode(chunkValue);
		} else if (chunkValue instanceof ArrayBuffer) {
			bytes = new Uint8Array(chunkValue);
		} else {
			throw new TypeError("PDF stream emitted an unsupported chunk type.");
		}

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
	const stream: unknown = await instance.toBuffer();

	if (!isAsyncIterable(stream)) {
		throw new TypeError("PDF renderer returned an unsupported stream.");
	}

	return await readStream(stream);
}
