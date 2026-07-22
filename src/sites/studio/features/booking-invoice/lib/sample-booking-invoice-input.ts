import {
	calculateMultiBookingAmounts,
	getMultiBookingInvoiceDueAt
} from "#studio/features/booking-form/lib/booking-pricing";
import { createMultiBookingInvoiceLineItemSnapshot } from "#studio/features/booking-invoice/lib/build-booking-invoice-data";
import type { BookingInvoiceBuilderInput } from "#studio/features/booking-invoice/lib/types";
import { z } from "zod";

const bookingInvoiceIdSchema = z.custom<BookingInvoiceBuilderInput["bookingId"]>(
	(value) => typeof value === "string" && value.length > 0
);

export const SAMPLE_BOOKING_INVOICE_INPUT: BookingInvoiceBuilderInput = {
	bookingId: bookingInvoiceIdSchema.parse("preview-booking-001"),
	name: "Alex Morgan",
	phone: "0400 123 456",
	accountName: "North Star Media",
	abn: "12345678901",
	email: "alex@example.com",
	date: "2026-05-07",
	time: "14:00",
	duration: "2h",
	service: "Table Setup",
	addons: ["4K UHD Recording", "Clips Package", "Remote Podcast"],
	leadTimeMinutes: 12 * 60,
	createdAt: Date.UTC(2026, 3, 19, 2, 0, 0),
	rescheduleUrl: "https://vvstudios.example/reschedule/preview-token"
};

const SAMPLE_MULTI_BOOKING_CREATED_AT = Date.UTC(2026, 3, 19, 2, 0, 0);
const SAMPLE_MULTI_BOOKING_ADDONS: BookingInvoiceBuilderInput["addons"] = [
	"4K UHD Recording",
	"Clips Package"
];
const SAMPLE_MULTI_BOOKING_PRICING = {
	duration: "2h" as const,
	addons: SAMPLE_MULTI_BOOKING_ADDONS,
	clipsPackageQuantity: "2" as const,
	packageSize: 8 as const
};
const SAMPLE_MULTI_BOOKING_AMOUNTS = calculateMultiBookingAmounts(SAMPLE_MULTI_BOOKING_PRICING);
const SAMPLE_MULTI_BOOKING_LINE_ITEMS = createMultiBookingInvoiceLineItemSnapshot({
	...SAMPLE_MULTI_BOOKING_PRICING,
	discountAmount: SAMPLE_MULTI_BOOKING_AMOUNTS.discountAmount,
	discountPercent: SAMPLE_MULTI_BOOKING_AMOUNTS.discountPercent
});

export const SAMPLE_MULTI_BOOKING_INVOICE_INPUT = {
	bookingId: bookingInvoiceIdSchema.parse("preview-package-001"),
	name: "Jamie Carter",
	phone: "0400 987 654",
	accountName: "Southern Cross Shows",
	abn: "98765432109",
	email: "jamie@example.com",
	createdAt: SAMPLE_MULTI_BOOKING_CREATED_AT,
	invoiceDueAt: getMultiBookingInvoiceDueAt(SAMPLE_MULTI_BOOKING_CREATED_AT),
	invoiceNumber: "VV-20260419-PACK",
	...SAMPLE_MULTI_BOOKING_PRICING,
	...SAMPLE_MULTI_BOOKING_AMOUNTS,
	leadTimeMinutes: 12 * 60,
	invoiceLineItems: SAMPLE_MULTI_BOOKING_LINE_ITEMS
};
