import type { BookingInvoiceBuilderInput } from "#/features/booking-invoice/lib/types";

export const SAMPLE_BOOKING_INVOICE_INPUT: BookingInvoiceBuilderInput = {
	bookingId: "preview-booking-001" as BookingInvoiceBuilderInput["bookingId"],
	name: "Alex Morgan",
	phone: "0400 123 456",
	accountName: "North Star Media",
	abn: "12345678901",
	email: "alex@example.com",
	date: "2026-05-07",
	time: "14:00",
	duration: "2h",
	service: "Table Setup",
	addons: ["4K UHD Recording", "10 Social Media Clips"],
	createdAt: Date.UTC(2026, 3, 19, 2, 0, 0),
};
