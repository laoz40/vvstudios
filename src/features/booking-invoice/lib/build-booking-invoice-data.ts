import { format } from "date-fns";
import {
	ADDON_PRICES,
	BOOKING_DEPOSIT_AMOUNT,
	BOOKING_INVOICE_BUSINESS,
	BOOKING_INVOICE_CURRENCY,
	BOOKING_INVOICE_NOTES,
	BOOKING_INVOICE_PAYMENT,
	BOOKING_INVOICE_TITLE,
	DURATION_PRICES,
} from "#/features/booking-invoice/lib/constants";
import { sumMoney } from "#/features/booking-invoice/lib/money";
import type {
	BookingInvoiceBuilderInput,
	BookingInvoiceData,
	BookingInvoiceLineItem,
} from "#/features/booking-invoice/lib/types";

function formatCalendarDate(value: string) {
	return format(new Date(`${value}T00:00:00`), "d MMMM yyyy");
}

function formatInvoiceNumber(
	bookingId: BookingInvoiceBuilderInput["bookingId"],
	invoiceDate: number,
) {
	const datePart = format(invoiceDate, "yyyyMMdd");
	const suffix = String(bookingId)
		.replace(/[^a-zA-Z0-9]/g, "")
		.toUpperCase()
		.slice(0, 8);

	return `VV-${datePart}-${suffix}`;
}

export function buildBookingInvoiceData(input: BookingInvoiceBuilderInput): BookingInvoiceData {
	const baseAmount = DURATION_PRICES[input.duration];
	const addonsAmount = sumMoney(input.addons.map((addon) => ADDON_PRICES[addon]));
	const subtotalAmount = baseAmount + addonsAmount;
	const totalDueAmount = Math.max(subtotalAmount - BOOKING_DEPOSIT_AMOUNT, 0);
	const bookingDateLabel = formatCalendarDate(input.date);
	const invoiceDate = input.createdAt ?? Date.now();
	const invoiceDateLabel = format(invoiceDate, "d MMMM yyyy");
	const dueDateLabel = bookingDateLabel;
	const addonsSummary =
		input.addons.length > 0
			? input.addons.map((addon) => `${addon} (${ADDON_PRICES[addon].toFixed(2)})`).join(", ")
			: "No add-ons selected";

	const lineItems: BookingInvoiceLineItem[] = [
		{
			amount: baseAmount,
			description: `${input.service} podcast studio hire (${input.duration})`,
			quantity: 1,
			rate: baseAmount,
		},
		...input.addons.map((addon) => ({
			amount: ADDON_PRICES[addon],
			description: addon,
			quantity: 1,
			rate: ADDON_PRICES[addon],
		})),
		{
			amount: -BOOKING_DEPOSIT_AMOUNT,
			description: "Deposit paid",
			quantity: 1,
			rate: -BOOKING_DEPOSIT_AMOUNT,
		},
	];

	return {
		amounts: {
			addonsAmount,
			baseAmount,
			currency: BOOKING_INVOICE_CURRENCY,
			depositAmount: BOOKING_DEPOSIT_AMOUNT,
			subtotalAmount,
			totalDueAmount,
		},
		booking: {
			addons: input.addons,
			addonsSummary,
			bookingDate: input.date,
			bookingDateLabel,
			duration: input.duration,
			service: input.service,
			time: input.time,
		},
		branding: {
			businessName: BOOKING_INVOICE_BUSINESS.businessName,
			contactEmail: BOOKING_INVOICE_BUSINESS.contactEmail,
			locationAddress: BOOKING_INVOICE_BUSINESS.locationAddress,
			locationLabel: BOOKING_INVOICE_BUSINESS.locationLabel,
			locationUrl: BOOKING_INVOICE_BUSINESS.locationUrl,
			ownerName: BOOKING_INVOICE_BUSINESS.ownerName,
		},
		customer: {
			abn: input.abn,
			accountName: input.accountName,
			email: input.email,
			name: input.name,
			phone: input.phone,
		},
		invoice: {
			dueDate: input.date,
			dueDateLabel,
			invoiceDate: new Date(invoiceDate).toISOString(),
			invoiceDateLabel,
			number: formatInvoiceNumber(input.bookingId, invoiceDate),
			title: BOOKING_INVOICE_TITLE,
		},
		lineItems,
		notes: {
			cancellationPolicy: BOOKING_INVOICE_NOTES.cancellationPolicy,
			paymentNote: BOOKING_INVOICE_NOTES.paymentNote,
		},
		payment: {
			accountNumber: BOOKING_INVOICE_PAYMENT.accountNumber,
			bankTransferLabel: BOOKING_INVOICE_PAYMENT.bankTransferLabel,
			bsb: BOOKING_INVOICE_PAYMENT.bsb,
			payId: BOOKING_INVOICE_PAYMENT.payId,
			payIdLabel: BOOKING_INVOICE_PAYMENT.payIdLabel,
		},
	};
}
