import {
	calculatePackageAmounts,
	getPackageInvoiceDueAt
} from "#studio/features/booking-form/lib/booking-pricing";
import { createPackageInvoiceLineItemSnapshot } from "#studio/features/booking-invoice/lib/build-booking-invoice-data";
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
	addons: ["4K UHD Recording", "Clip Volume Pack", "Remote Podcast"],
	leadTimeMinutes: 12 * 60,
	createdAt: Date.UTC(2026, 3, 19, 2, 0, 0),
	rescheduleUrl: "https://vvstudios.example/reschedule/preview-token"
};

const SAMPLE_PACKAGE_CREATED_AT = Date.UTC(2026, 3, 19, 2, 0, 0);
const SAMPLE_PACKAGE_ADDONS: BookingInvoiceBuilderInput["addons"] = [
	"4K UHD Recording",
	"Clip Volume Pack"
];
const SAMPLE_PACKAGE_PRICING = {
	duration: "2h" as const,
	addons: SAMPLE_PACKAGE_ADDONS,
	clipsPackageQuantity: "2" as const,
	packageSize: 8 as const
};
const SAMPLE_PACKAGE_AMOUNTS = calculatePackageAmounts(SAMPLE_PACKAGE_PRICING);
const SAMPLE_PACKAGE_LINE_ITEMS = createPackageInvoiceLineItemSnapshot({
	...SAMPLE_PACKAGE_PRICING,
	discountAmount: SAMPLE_PACKAGE_AMOUNTS.discountAmount,
	discountPercent: SAMPLE_PACKAGE_AMOUNTS.discountPercent
});

export const SAMPLE_PACKAGE_INVOICE_INPUT = {
	bookingId: bookingInvoiceIdSchema.parse("preview-package-001"),
	name: "Jamie Carter",
	phone: "0400 987 654",
	accountName: "Southern Cross Shows",
	abn: "98765432109",
	email: "jamie@example.com",
	createdAt: SAMPLE_PACKAGE_CREATED_AT,
	invoiceDueAt: getPackageInvoiceDueAt(SAMPLE_PACKAGE_CREATED_AT),
	invoiceNumber: "VV-20260419-PACK",
	...SAMPLE_PACKAGE_PRICING,
	...SAMPLE_PACKAGE_AMOUNTS,
	leadTimeMinutes: 12 * 60,
	invoiceLineItems: SAMPLE_PACKAGE_LINE_ITEMS
};
