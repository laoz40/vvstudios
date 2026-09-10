import type { BookingInvoiceData } from "#studio/features/booking-invoice/lib/types";
import { createBookingInvoicePdfInstance } from "#studio/features/booking-invoice/pdf/create-booking-invoice-pdf-base";
import { z } from "zod";

const pdfStreamChunkSchema = z.union([
	z.instanceof(Uint8Array),
	z.string(),
	z.instanceof(ArrayBuffer)
]);

const asyncIterableSchema = z.custom<AsyncIterable<unknown>>((value) => {
	if (value === null || Array.isArray(value) || !(value instanceof Object)) {
		return false;
	}

	if (!(Symbol.asyncIterator in value)) {
		return false;
	}

	const iteratorCandidate = value[Symbol.asyncIterator];

	return z.function().safeParse(iteratorCandidate).success;
});

function isAsyncIterable(value: unknown): value is AsyncIterable<unknown> {
	return asyncIterableSchema.safeParse(value).success;
}

async function readStream(stream: AsyncIterable<unknown>) {
	const chunks: Uint8Array[] = [];
	let totalLength = 0;

	for await (const chunk of stream) {
		const parsedChunk = pdfStreamChunkSchema.safeParse(chunk);

		if (!parsedChunk.success) {
			throw new TypeError("PDF stream emitted an unsupported chunk type.");
		}

		const bytes =
			parsedChunk.data instanceof Uint8Array
				? parsedChunk.data
				: parsedChunk.data instanceof ArrayBuffer
					? new Uint8Array(parsedChunk.data)
					: new TextEncoder().encode(parsedChunk.data);

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

	return readStream(stream);
}
