import { SAMPLE_BOOKING_INVOICE_INPUT } from "#studio/features/booking-invoice/lib/sample-booking-invoice-input";
import type { BookingReceiptBuilderInput } from "#studio/features/booking-invoice/lib/types";
import { z } from "zod";

const bookingReceiptIdSchema = z.custom<BookingReceiptBuilderInput["bookingId"]>(
	(value) => z.string().min(1).safeParse(value).success
);

export const SAMPLE_BOOKING_RECEIPT_INPUT: BookingReceiptBuilderInput = {
	...SAMPLE_BOOKING_INVOICE_INPUT,
	bookingId: bookingReceiptIdSchema.parse("preview-booking-receipt-001")
};
